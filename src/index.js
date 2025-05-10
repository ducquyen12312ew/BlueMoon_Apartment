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

app.get("/admin/dashboard", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get real statistics from database
        const totalApartments = await ApartmentCollection.countDocuments();
        const totalResidents = await ResidentCollection.countDocuments();
        
        // Get payment stats
        const khoanThuList = await KhoanThuCollection.find();
        const nopTienList = await NopTienCollection.find();
        
        // Calculate payment percentage
        let totalPaymentsExpected = 0;
        let totalPaymentsReceived = 0;
        let paymentPercentage = 0;
        let unpaidHouseholds = 0;
        
        if (khoanThuList.length > 0) {
            // For mandatory payments only (loaiKhoanThu === 0)
            const mandatoryPayments = khoanThuList.filter(kt => kt.loaiKhoanThu === 0);
            
            if (mandatoryPayments.length > 0) {
                totalPaymentsExpected = mandatoryPayments.length * totalApartments;
                
                // Count unique apartment-payment combinations
                const uniquePayments = new Set();
                nopTienList.forEach(payment => {
                    // Find the khoanThu document
                    const khoanThuId = payment.khoanThu.toString();
                    const khoanThu = khoanThuList.find(kt => kt._id.toString() === khoanThuId);
                    
                    // Only count mandatory payments
                    if (khoanThu && khoanThu.loaiKhoanThu === 0) {
                        uniquePayments.add(`${payment.canHo || 'unknown'}-${khoanThuId}`);
                    }
                });
                
                totalPaymentsReceived = uniquePayments.size;
            }
            
            // Calculate percentages
            paymentPercentage = totalPaymentsExpected > 0 
                ? ((totalPaymentsReceived / totalPaymentsExpected) * 100).toFixed(1) 
                : 0;
                
            // Calculate unpaid households
            const uniquePayingHouseholds = new Set();
            nopTienList.forEach(payment => {
                if (payment.canHo) {
                    uniquePayingHouseholds.add(payment.canHo);
                }
            });
            
            unpaidHouseholds = totalApartments - uniquePayingHouseholds.size;
        }
        
        // Ensure we have reasonable values even if calculation returns zero
        paymentPercentage = paymentPercentage > 0 ? paymentPercentage : '0.0';
        unpaidHouseholds = unpaidHouseholds >= 0 ? unpaidHouseholds : 0;
        
        // Get monthly payment history for chart
        // This will group payments by month and calculate totals
        const monthlyPaymentsMap = new Map();
        
        // Define last 7 months for chart
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthLabel = `T${month.getMonth() + 1}/${month.getFullYear()}`;
            monthlyPaymentsMap.set(monthLabel, { paid: 0, total: 0 });
        }
        
        // Process actual payments
        nopTienList.forEach(payment => {
            const date = new Date(payment.ngayNop);
            const monthLabel = `T${date.getMonth() + 1}/${date.getFullYear()}`;
            
            if (monthlyPaymentsMap.has(monthLabel)) {
                const monthData = monthlyPaymentsMap.get(monthLabel);
                monthData.paid += payment.soTien;
                monthlyPaymentsMap.set(monthLabel, monthData);
            }
        });
        
        // Convert to array for the template
        const monthlyData = Array.from(monthlyPaymentsMap, ([month, data]) => ({
            month,
            paid: Math.round(data.paid / 1000), // Convert to thousands for better display
            total: 30 // Placeholder, you can calculate this based on your data
        }));
        
        // Get payment status breakdown for pie chart
        const now = new Date();
        const onTimeCount = nopTienList.filter(p => p.trangThai === 'on-time').length;
        const lateCount = nopTienList.filter(p => p.trangThai === 'late').length;
        const partialCount = nopTienList.filter(p => p.trangThai === 'partial').length;
        
        const paymentBreakdown = {
            onTime: onTimeCount || 40,
            late: lateCount || 30,
            unpaid: unpaidHouseholds || 10,
            exempt: 20 // Placeholder, you might need to calculate this differently
        };
        
        res.render("admin-dashboard", {
            totalApartments: totalApartments || 245,
            totalResidents: totalResidents || 789,
            paymentPercentage,
            unpaidHouseholds,
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
        // Instead of trying to render list-khoan-thu, redirect to the create form
        res.redirect("/khoan-thu/create");
    } catch (error) {
        console.error("Error redirecting to create khoản thu:", error);
        res.status(500).send("Error processing your request");
    }
});

// Create khoản thu form
app.get("/khoan-thu/create", ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render("create-khoan-thu");
});

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
        
        // Parse date strings properly
        // For ngayTao: Use current date if not provided or invalid
        let parsedNgayTao = new Date();
        if (ngayTao) {
            // Check if the date is in dd/mm/yyyy format
            if (ngayTao.includes('/')) {
                const [day, month, year] = ngayTao.split('/');
                parsedNgayTao = new Date(year, month - 1, day); // month is 0-indexed in JS
            } else {
                // Try direct parsing
                const dateAttempt = new Date(ngayTao);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedNgayTao = dateAttempt;
                }
            }
        }
        
        // For hanThanhToan: Similar parsing logic
        let parsedHanThanhToan = null;
        if (hanThanhToan) {
            if (hanThanhToan.includes('/')) {
                const [day, month, year] = hanThanhToan.split('/');
                parsedHanThanhToan = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(hanThanhToan);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedHanThanhToan = dateAttempt;
                }
            }
        }
        
        // Create new khoản thu with properly parsed dates
        const newKhoanThu = new KhoanThuCollection({
            maKhoanThu,
            tenKhoanThu,
            soTien: parseFloat(soTien),
            loaiKhoanThu: parseInt(loaiKhoanThu || 0),
            ngayTao: parsedNgayTao,
            hanThanhToan: parsedHanThanhToan,
            moTa: moTa || ""
        });
        
        await newKhoanThu.save();
        
        res.redirect("/khoan-thu");
    } catch (error) {
        console.error("Error creating khoản thu:", error);
        res.render("create-khoan-thu", { 
            error: "Lỗi khi tạo khoản thu: " + error.message,
            formData: req.body
        });
    }
});

// Thu phí routes
app.get("/thu-phi", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get all khoản thu for dropdown, sorted by newest first
        const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
        
        res.render("thu-phi", { khoanThuList });
    } catch (error) {
        console.error("Error loading thu phí form:", error);
        res.status(500).send("Error loading thu phí form");
    }
});
app.post("/thu-phi/create", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { tenKhoanThu, tenNguoiNop, ngayNop, paymentMethod, canHo } = req.body;
        
        // Validate inputs
        if (!tenKhoanThu || !tenNguoiNop || !ngayNop || !canHo) {
            // Get khoản thu list for re-rendering the form
            const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
            
            return res.render("thu-phi", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                formData: req.body,
                khoanThuList
            });
        }
        
        // Get the khoản thu details
        const khoanThu = await KhoanThuCollection.findById(tenKhoanThu);
        if (!khoanThu) {
            const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
            return res.render("thu-phi", { 
                error: "Không tìm thấy khoản thu",
                formData: req.body,
                khoanThuList
            });
        }
        
        // Check if this person already paid for this khoản thu
        const existingPayment = await NopTienCollection.findOne({ 
            khoanThu: tenKhoanThu,
            canHo: canHo
        });
        
        if (existingPayment) {
            const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
            return res.render("thu-phi", { 
                error: "Căn hộ này đã nộp khoản phí này!",
                formData: req.body,
                khoanThuList
            });
        }
        
        // Parse date properly
        let paymentDate;
        if (ngayNop.includes('/')) {
            const [day, month, year] = ngayNop.split('/');
            paymentDate = new Date(year, month - 1, day);
        } else {
            paymentDate = new Date(ngayNop);
        }
        
        // Determine payment status
        let paymentStatus = 'on-time';
        if (khoanThu.hanThanhToan && paymentDate > khoanThu.hanThanhToan) {
            paymentStatus = 'late';
        }
        
        // Create new payment record
        const newPayment = new NopTienCollection({
            khoanThu: tenKhoanThu,
            tenNguoiNop,
            ngayNop: paymentDate,
            soTien: khoanThu.soTien,
            phuongThucThanhToan: paymentMethod || "cash",
            nguoiThu: req.session.name,
            canHo: canHo,
            trangThai: paymentStatus
        });
        
        await newPayment.save();
        
        res.redirect("/thong-ke");
    } catch (error) {
        console.error("Error processing payment:", error);
        const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
        res.render("thu-phi", { 
            error: "Lỗi khi xử lý thu phí: " + error.message,
            formData: req.body,
            khoanThuList
        });
    }
});

app.get("/thong-ke", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Get all payments with related khoản thu info - sort by newest first
        const payments = await NopTienCollection.find()
            .populate('khoanThu')
            .sort({ ngayNop: -1 }); // -1 sorts in descending order (newest first)
        
        // Format the data for the template
        const formattedPayments = payments.map(payment => {
            return {
                id: payment._id,
                canHo: payment.canHo || 'N/A',
                tenKhoanThu: payment.khoanThu ? payment.khoanThu.tenKhoanThu : 'Unknown',
                tenNguoiNop: payment.tenNguoiNop,
                soTien: payment.soTien,
                ngayNop: payment.ngayNop,
                phuongThucThanhToan: payment.phuongThucThanhToan,
                trangThai: payment.trangThai
            };
        });
        
        res.render("thong-ke", { payments: formattedPayments });
    } catch (error) {
        console.error("Error loading statistics:", error);
        res.status(500).send("Error loading statistics: " + error.message);
    }
});
// Add this route to your index.js file
app.get("/clear-payment-data", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Delete all payment records
        await NopTienCollection.deleteMany({});
        console.log("All payment records cleared");
        res.redirect("/thong-ke");
    } catch (error) {
        console.error("Error clearing payment data:", error);
        res.status(500).send("Error clearing payment data");
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