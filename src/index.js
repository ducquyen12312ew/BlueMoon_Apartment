const express = require("express");
const path = require("path");
const session = require('express-session');
const { 
    UserCollection, 
    ApartmentCollection, 
    ResidentCollection, 
    MaintenanceRequestCollection, 
    PaymentCollection,
    NoticeCollection,
    KhoanThuCollection,
    NopTienCollection
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
app.set("views", path.join(__dirname, "../views"));

// Make user info available to all views and set current path
app.use((req, res, next) => {
    // Add the current path to res.locals
    res.locals.path = req.path;
    
    // Add user info to res.locals
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
            // Redirect to admin dashboard
            return res.redirect("/admin/dashboard");
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

        // Check if username is "admin" and password is "123456789"
        if(username === "admin" && password === "123456789") {
            // Set session data
            req.session.name = "admin";
            req.session.role = "admin";
            req.session.userId = "1"; // Using a fixed ID for admin
            
            return res.redirect("/admin/dashboard");
        } else {
            return res.render("login", { error: "Tài khoản hoặc mật khẩu không chính xác" });
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

// Dashboard
app.get("/admin/dashboard", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get statistics for dashboard
        const totalApartments = await ApartmentCollection.countDocuments();
        const totalResidents = await ResidentCollection.countDocuments();
        
        // Get payment stats
        const khoanThuList = await KhoanThuCollection.find();
        const nopTienList = await NopTienCollection.find();
        
        // Calculate payment percentage
        let totalPaymentsExpected = 0;
        let totalPaymentsReceived = 0;
        
        if (khoanThuList.length > 0 && nopTienList.length > 0) {
            // Calculate based on actual data
            totalPaymentsExpected = khoanThuList.length * totalApartments;
            totalPaymentsReceived = nopTienList.length;
        } else {
            // Default values for demo
            totalPaymentsExpected = 100;
            totalPaymentsReceived = 89.5;
        }
        
        const paymentPercentage = ((totalPaymentsReceived / totalPaymentsExpected) * 100).toFixed(1);
        const unpaidHouseholds = totalApartments - Math.floor((totalPaymentsReceived / khoanThuList.length) || 0);
        
        // Get monthly payment history for chart
        const monthlyData = [
            { month: "T1/2023", paid: 70, total: 30 },
            { month: "T2/2023", paid: 80, total: 25 },
            { month: "T3/2023", paid: 90, total: 30 },
            { month: "T4/2023", paid: 75, total: 25 },
            { month: "T5/2023", paid: 100, total: 30 },
            { month: "T6/2023", paid: 120, total: 30 },
            { month: "T7/2023", paid: 125, total: 35 }
        ];
        
        // Get payment status breakdown for pie chart
        const paymentBreakdown = {
            onTime: 40,
            late: 30,
            unpaid: 10,
            exempt: 20
        };
        
        res.render("admin-dashboard", {
            totalApartments: totalApartments || 245,
            totalResidents: totalResidents || 789,
            paymentPercentage: paymentPercentage || 89.5,
            unpaidHouseholds: unpaidHouseholds || 26,
            monthlyData,
            paymentBreakdown
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Error loading dashboard: " + error.message);
    }
});

// Khoản thu routes
// List all khoản thu
app.get("/khoan-thu", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const khoanThuList = await KhoanThuCollection.find().sort({ createdAt: -1 });
        res.render("list-khoan-thu", { khoanThuList });
    } catch (error) {
        console.error("Error loading khoản thu list:", error);
        res.status(500).send("Error loading khoản thu list");
    }
});

// Create khoản thu form
app.get("/khoan-thu/create", ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render("create-khoan-thu");
});

// Create khoản thu process
app.post("/khoan-thu/create", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { maKhoanThu, tenKhoanThu, soTien, loaiKhoanThu, ngayTao, hanThanhToan, moTa } = req.body;
        
        // Validate inputs
        if (!maKhoanThu || !tenKhoanThu || !soTien) {
            return res.render("create-khoan-thu", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                formData: req.body
            });
        }
        
        // Check if maKhoanThu already exists
        const existingKhoanThu = await KhoanThuCollection.findOne({ maKhoanThu });
        if (existingKhoanThu) {
            return res.render("create-khoan-thu", { 
                error: "Mã khoản thu đã tồn tại",
                formData: req.body
            });
        }
        
        // Create new khoản thu
        const newKhoanThu = new KhoanThuCollection({
            maKhoanThu,
            tenKhoanThu,
            soTien: parseFloat(soTien),
            loaiKhoanThu: parseInt(loaiKhoanThu || 0),
            ngayTao: ngayTao || new Date(),
            hanThanhToan: hanThanhToan || null,
            moTa: moTa || ""
        });
        
        await newKhoanThu.save();
        
        res.redirect("/khoan-thu");
    } catch (error) {
        console.error("Error creating khoản thu:", error);
        res.render("create-khoan-thu", { 
            error: "Lỗi khi tạo khoản thu",
            formData: req.body
        });
    }
});

// Thu phí routes
// Create thu phí form
app.get("/thu-phi", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get list of khoản thu for dropdown
        const khoanThuList = await KhoanThuCollection.find({ hanThanhToan: { $gte: new Date() } }).sort({ ngayTao: -1 });
        
        res.render("thu-phi", { khoanThuList });
    } catch (error) {
        console.error("Error loading thu phí form:", error);
        res.status(500).send("Error loading thu phí form");
    }
});

// Create thu phí process
app.post("/thu-phi/create", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { tenKhoanThu, tenNguoiNop, ngayNop, paymentMethod } = req.body;
        
        // Validate inputs
        if (!tenKhoanThu || !tenNguoiNop || !ngayNop) {
            return res.render("thu-phi", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                formData: req.body
            });
        }
        
        // Get the khoản thu details
        const khoanThu = await KhoanThuCollection.findById(tenKhoanThu);
        if (!khoanThu) {
            return res.render("thu-phi", { 
                error: "Không tìm thấy khoản thu",
                formData: req.body
            });
        }
        
        // Check if this person already paid for this khoản thu
        const existingPayment = await NopTienCollection.findOne({ 
            khoanThu: tenKhoanThu,
            tenNguoiNop
        });
        
        if (existingPayment) {
            return res.render("thu-phi", { 
                error: "Người này đã từng nộp khoản phí này!",
                formData: req.body
            });
        }
        
        // Create new payment record
        const newPayment = new NopTienCollection({
            khoanThu: tenKhoanThu,
            tenNguoiNop,
            ngayNop: new Date(ngayNop),
            soTien: khoanThu.soTien,
            phuongThucThanhToan: paymentMethod || "cash",
            nguoiThu: req.session.name
        });
        
        await newPayment.save();
        
        res.redirect("/thong-ke");
    } catch (error) {
        console.error("Error processing payment:", error);
        res.render("thu-phi", { 
            error: "Lỗi khi xử lý thu phí",
            formData: req.body
        });
    }
});

// Thống kê routes
app.get("/thong-ke", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get all payments with related khoản thu info
        const payments = await NopTienCollection.find()
            .populate('khoanThu')
            .sort({ ngayNop: -1 });
        
        res.render("thong-ke", { payments });
    } catch (error) {
        console.error("Error loading statistics:", error);
        res.status(500).send("Error loading statistics");
    }
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

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Apartment Management System running on port ${port}`);
});