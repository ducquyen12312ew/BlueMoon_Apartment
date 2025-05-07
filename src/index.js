const express = require("express");
const path = require("path");
const session = require('express-session');
const { 
    UserCollection, 
    ApartmentCollection, 
    ResidentCollection, 
    MaintenanceRequestCollection, 
    PaymentCollection,
    NoticeCollection
} = require('./config');

const app = express();

// Session configuration
app.use(session({
    secret: 'apartment-management-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false },
    name: 'apartment_session'
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// View engine
app.set("view engine", "ejs");

// Make user info available to all views
app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null,
        id: req.session.userId || null
    };
    next();
});

// Home route
app.get("/", async (req, res) => {
    try {
        // If user is logged in, show dashboard
        if (req.session.userId) {
            // Get recent notices (announcements)
            const notices = await NoticeCollection.find()
                .sort({ postedAt: -1 })
                .limit(5)
                .populate('postedBy', 'name');
                
            // Get maintenance requests if admin or manager
            let pendingRequests = [];
            if (req.session.role === 'admin' || req.session.role === 'manager') {
                pendingRequests = await MaintenanceRequestCollection.find({ status: 'pending' })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('apartment', 'number block')
                    .populate('requestedBy', 'name');
            }
            
            // Get apartments info if admin or manager
            let apartmentStats = null;
            if (req.session.role === 'admin' || req.session.role === 'manager') {
                const totalApartments = await ApartmentCollection.countDocuments();
                const occupiedApartments = await ApartmentCollection.countDocuments({ isOccupied: true });
                const vacantApartments = totalApartments - occupiedApartments;
                
                apartmentStats = {
                    total: totalApartments,
                    occupied: occupiedApartments,
                    vacant: vacantApartments,
                    occupancyRate: totalApartments > 0 ? ((occupiedApartments / totalApartments) * 100).toFixed(1) : 0
                };
            }
            
            // Get resident-specific information if role is resident
            let residentInfo = null;
            let maintenanceHistory = [];
            let payments = [];
            
            if (req.session.role === 'resident') {
                // Get resident info
                residentInfo = await ResidentCollection.findOne({ user: req.session.userId })
                    .populate('apartment', 'number block floor type area');
                
                if (residentInfo) {
                    // Get resident's maintenance requests
                    maintenanceHistory = await MaintenanceRequestCollection.find({ requestedBy: req.session.userId })
                        .sort({ createdAt: -1 })
                        .limit(3);
                    
                    // Get resident's payment history
                    payments = await PaymentCollection.find({ resident: residentInfo._id })
                        .sort({ dueDate: -1 })
                        .limit(3);
                }
            }
            
            // Render dashboard with relevant data
            res.render("dashboard", { 
                notices, 
                pendingRequests, 
                apartmentStats,
                residentInfo,
                maintenanceHistory,
                payments
            });
        } else {
            // Not logged in, show home page
            res.render("home");
        }
    } catch (error) {
        console.error("Error loading home page:", error);
        res.status(500).send("Error loading page");
    }
});

// Login page
app.get("/login", (req, res) => {
    res.render("login");
});

// Login process
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await UserCollection.findOne({ name: username });
        
        if (!user) {
            return res.render("login", { error: "Username does not exist" });
        }

        // Compare password (using simple comparison for now)
        const validPassword = password === user.password; // In a real app, use bcrypt.compare
        
        if (!validPassword) {
            return res.render("login", { error: "Incorrect password" });
        }

        // Set session data
        req.session.name = user.name;
        req.session.role = user.role;
        req.session.userId = user._id;

        // Redirect based on role
        if (user.role === 'admin') {
            return res.redirect("/admin/dashboard");
        } else if (user.role === 'manager') {
            return res.redirect("/manager/dashboard");
        } else if (user.role === 'security') {
            return res.redirect("/security/dashboard");
        } else {
            // Resident
            return res.redirect("/resident/dashboard");
        }

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("login", { error: "Login error" });
    }
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).send("Error during logout");
        }
        res.redirect("/login");
    });
});

// Basic dashboard routes for different roles
app.get("/admin/dashboard", ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render("admin-dashboard");
});

app.get("/manager/dashboard", ensureAuthenticated, ensureManager, (req, res) => {
    res.render("manager-dashboard");
});

app.get("/security/dashboard", ensureAuthenticated, ensureSecurity, (req, res) => {
    res.render("security-dashboard");
});

app.get("/resident/dashboard", ensureAuthenticated, ensureResident, (req, res) => {
    res.render("resident-dashboard");
});

// Middleware functions to ensure authentication and role permissions
function ensureAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect("/login");
}

function ensureAdmin(req, res, next) {
    if (req.session.role === 'admin') {
        return next();
    }
    res.status(403).send("Access Denied: Admin privileges required");
}

function ensureManager(req, res, next) {
    if (req.session.role === 'admin' || req.session.role === 'manager') {
        return next();
    }
    res.status(403).send("Access Denied: Manager privileges required");
}

function ensureSecurity(req, res, next) {
    if (req.session.role === 'admin' || req.session.role === 'manager' || req.session.role === 'security') {
        return next();
    }
    res.status(403).send("Access Denied: Security privileges required");
}

function ensureResident(req, res, next) {
    if (req.session.role === 'resident') {
        return next();
    }
    res.status(403).send("Access Denied: Resident privileges required");
}

// Function to create default admin account if none exists
async function createDefaultAdmin() {
    try {
        const adminExists = await UserCollection.findOne({ role: 'admin' });
        if (!adminExists) {
            await UserCollection.create({
                name: 'admin',
                password: 'admin123',
                role: 'admin',
                email: 'admin@apartmentmanagement.com'
            });
            
            console.log('Default admin account created');
        }

        // Create a manager account
        const managerExists = await UserCollection.findOne({ role: 'manager' });
        if (!managerExists) {
            await UserCollection.create({
                name: 'manager',
                password: 'manager123',
                role: 'manager',
                email: 'manager@apartmentmanagement.com'
            });
            
            console.log('Default manager account created');
        }
    } catch (error) {
        console.error('Error creating default accounts:', error);
    }
}

// Start the server
const port = 5000;
app.listen(port, () => {
    createDefaultAdmin();
    console.log(`Apartment Management System running on port ${port}`);
});