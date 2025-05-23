const express = require("express");
const path = require("path");
const session = require('express-session');
const puppeteer = require('puppeteer'); 
const { 
    UserCollection, 
    ApartmentCollection, 
    ResidentCollection, 
    PaymentCollection,
    NoticeCollection,
    KhoanThuCollection,
    HoKhauCollection,
    NhanKhauCollection,
    TamTruCollection,
    TamVangCollection,
    BienDoiNhanKhauCollection,
    NopTienCollection,
    MaintenanceStaffCollection,
    FeedbackCollection,
    ResidentProfileCollection
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

// In src/index.js
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if(username === "ketoan" && password === "123456789") {
            // Set session data
            req.session.name = "admin";
            req.session.role = "admin";
            req.session.userId = "1";
            
            return res.redirect("/admin/dashboard");
        } 
        else if(username === "totruong" && password === "123456789") {
            // Tổ trưởng/Tổ phó account
            req.session.name = "toquan";
            req.session.role = "toquan";
            req.session.userId = "3";
            
            return res.redirect("/toquan/dashboard");
        } 
        else if(username === "topho" && password === "123456789") {
            // Tổ trưởng/Tổ phó account
            req.session.name = "topho";
            req.session.role = "topho";
            req.session.userId = "4";
            
            return res.redirect("/topho/dashboard");
        } 
        else if(username === "cudan1" && password === "123456789") {
            // Tổ trưởng/Tổ phó account
            req.session.name = "cudan";
            req.session.role = "cudan";
            req.session.userId = "10";
            
            return res.redirect("/cudan/dashboard");
        } 
        else {
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
app.get("/api/khoan-thu", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
        res.json(khoanThuList);
    } catch (error) {
        console.error("Error fetching khoan thu:", error);
        res.status(500).json({ error: "Error fetching khoan thu list" });
    }
});

// API route để lấy chi tiết một khoản thu
app.get("/api/khoan-thu/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const khoanThu = await KhoanThuCollection.findById(req.params.id);
        if (!khoanThu) {
            return res.status(404).json({ error: "Khoản thu không tồn tại" });
        }
        res.json(khoanThu);
    } catch (error) {
        console.error("Error fetching khoan thu:", error);
        res.status(500).json({ error: "Error fetching khoan thu details" });
    }
});
app.get("/khoan-thu/create", ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render("create-khoan-thu");
});
app.get("/khoan-thu", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        res.redirect("/khoan-thu/create");
    } catch (error) {
        console.error("Error redirecting to khoan thu:", error);
        res.status(500).send("Error processing your request");
    }
});
app.post("/khoan-thu/:id/edit", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { maKhoanThu, tenKhoanThu, soTien, loaiKhoanThu, ngayTao, hanThanhToan, moTa } = req.body;
        
        // Validate inputs
        if (!maKhoanThu || !tenKhoanThu || !soTien) {
            return res.status(400).json({ 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc"
            });
        }
        
        // Check if maKhoanThu already exists (excluding current record)
        const existingKhoanThu = await KhoanThuCollection.findOne({ 
            maKhoanThu, 
            _id: { $ne: req.params.id } 
        });
        
        if (existingKhoanThu) {
            return res.status(400).json({ 
                error: "Mã khoản thu đã tồn tại"
            });
        }
        
        // Parse dates
        let parsedNgayTao = new Date();
        if (ngayTao) {
            if (ngayTao.includes('/')) {
                const [day, month, year] = ngayTao.split('/');
                parsedNgayTao = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayTao);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedNgayTao = dateAttempt;
                }
            }
        }
        
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
        
        // Update khoản thu
        const updatedKhoanThu = await KhoanThuCollection.findByIdAndUpdate(
            req.params.id,
            {
                maKhoanThu,
                tenKhoanThu,
                soTien: parseFloat(soTien),
                loaiKhoanThu: parseInt(loaiKhoanThu || 0),
                ngayTao: parsedNgayTao,
                hanThanhToan: parsedHanThanhToan,
                moTa: moTa || ""
            },
            { new: true }
        );
        
        if (!updatedKhoanThu) {
            return res.status(404).json({ error: "Khoản thu không tồn tại" });
        }
        
        res.json({ success: true, data: updatedKhoanThu });
    } catch (error) {
        console.error("Error updating khoan thu:", error);
        res.status(500).json({ error: "Lỗi khi cập nhật khoản thu: " + error.message });
    }
});

// Route xóa khoản thu
app.delete("/khoan-thu/:id/delete", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        console.log("DELETE request received for ID:", req.params.id);
        
        const khoanThu = await KhoanThuCollection.findById(req.params.id);
        
        if (!khoanThu) {
            console.log("Khoan thu not found for ID:", req.params.id);
            return res.status(404).json({ error: "Khoản thu không tồn tại" });
        }
        
        console.log("Found khoan thu:", khoanThu.tenKhoanThu);
        
        // Check if there are any payments related to this khoản thu
        const relatedPayments = await NopTienCollection.countDocuments({ khoanThu: req.params.id });
        console.log("Related payments count:", relatedPayments);
        
        if (relatedPayments > 0) {
            return res.status(400).json({ 
                error: `Không thể xóa khoản thu này vì đã có ${relatedPayments} giao dịch thanh toán liên quan. Vui lòng xóa các giao dịch trước khi xóa khoản thu.` 
            });
        }
        
        // Delete the khoản thu
        const deletedKhoanThu = await KhoanThuCollection.findByIdAndDelete(req.params.id);
        console.log("Deleted khoan thu:", deletedKhoanThu ? "Success" : "Failed");
        
        if (!deletedKhoanThu) {
            return res.status(500).json({ error: "Không thể xóa khoản thu" });
        }
        
        res.json({ success: true, message: "Xóa khoản thu thành công" });
    } catch (error) {
        console.error("Error deleting khoan thu:", error);
        res.status(500).json({ error: "Lỗi khi xóa khoản thu: " + error.message });
    }
});
app.post("/khoan-thu/create", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { maKhoanThu, tenKhoanThu, soTien, loaiKhoanThu, ngayTao, hanThanhToan, moTa } = req.body;
        
        // Validate inputs
        if (!maKhoanThu || !tenKhoanThu || !soTien) {
            // Check if this is an AJAX request
            if (req.headers['content-type'] === 'application/x-www-form-urlencoded' && !req.headers.referer?.includes('create')) {
                return res.status(400).json({ 
                    error: "Vui lòng điền đầy đủ thông tin bắt buộc"
                });
            }
            
            return res.render("create-khoan-thu", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                formData: req.body
            });
        }
        
        // Check if maKhoanThu already exists
        const existingKhoanThu = await KhoanThuCollection.findOne({ maKhoanThu });
        if (existingKhoanThu) {
            if (req.headers['content-type'] === 'application/x-www-form-urlencoded' && !req.headers.referer?.includes('create')) {
                return res.status(400).json({ 
                    error: "Mã khoản thu đã tồn tại"
                });
            }
            
            return res.render("create-khoan-thu", { 
                error: "Mã khoản thu đã tồn tại",
                formData: req.body
            });
        }
        
        // Parse date strings properly
        let parsedNgayTao = new Date();
        if (ngayTao) {
            if (ngayTao.includes('/')) {
                const [day, month, year] = ngayTao.split('/');
                parsedNgayTao = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayTao);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedNgayTao = dateAttempt;
                }
            }
        }
        
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
        
        // Create new khoản thu
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
        
        // Return JSON for AJAX requests
        if (req.headers['content-type'] === 'application/x-www-form-urlencoded' && !req.headers.referer?.includes('create')) {
            return res.json({ success: true, data: newKhoanThu });
        }
        
        // Redirect for form submission
        res.redirect("/khoan-thu/create?success=1");
    } catch (error) {
        console.error("Error creating khoản thu:", error);
        
        if (req.headers['content-type'] === 'application/x-www-form-urlencoded' && !req.headers.referer?.includes('create')) {
            return res.status(500).json({ error: "Lỗi khi tạo khoản thu: " + error.message });
        }
        
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
app.get("/reset-sample-data", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Clear existing sample data
        await KhoanThuCollection.deleteMany({});
        await NopTienCollection.deleteMany({});
        
        // Create new sample data
        await createSampleData();
        
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Error resetting sample data:", error);
        res.status(500).send("Error resetting sample data");
    }
});
// Dashboard quản lý hộ khẩu
app.get("/toquan/dashboard", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Lấy số liệu thống kê từ database
        const totalHoKhau = await HoKhauCollection.countDocuments();
        const totalNhanKhau = await NhanKhauCollection.countDocuments();
        const totalTamTru = await TamTruCollection.countDocuments();
        const totalTamVang = await TamVangCollection.countDocuments();
        
        // Thống kê giới tính
        const maleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nam' });
        const femaleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nữ' });
        
        // Lấy dữ liệu biến đổi nhân khẩu gần đây
        const recentChanges = await BienDoiNhanKhauCollection.find()
            .sort({ ngayThayDoi: -1 })
            .limit(5)
            .populate('nhanKhau')
            .populate('hoKhau');
        
        res.render("toquan-dashboard", {
            totalHoKhau,
            totalNhanKhau,
            totalTamTru,
            totalTamVang,
            maleCount,
            femaleCount,
            recentChanges
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Error loading dashboard: " + error.message);
    }
});

// Danh sách hộ khẩu
app.get("/toquan/hokhau", ensureAuthenticated, ensureToQuan, async (req, res) => {
    // Redirect to the main household management page
    res.redirect("/toquan/hokhau-nhankhau");
});

// Thêm hộ khẩu mới
app.get("/toquan/hokhau/add", ensureAuthenticated, ensureToQuan, (req, res) => {
    res.render("add-hokhau");
});

app.post("/toquan/hokhau/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { soHoKhau, hoTenChuHo, diaChi, ngayLamHoKhau, ghiChu } = req.body;
        
        // Kiểm tra sổ hộ khẩu đã tồn tại chưa
        const existingHoKhau = await HoKhauCollection.findOne({ soHoKhau });
        if (existingHoKhau) {
            return res.render("add-hokhau", { 
                error: "Số hộ khẩu đã tồn tại",
                formData: req.body
            });
        }
        
        // Xử lý ngày nếu nhập vào định dạng dd/mm/yyyy
        let parsedDate = new Date();
        if (ngayLamHoKhau) {
            if (ngayLamHoKhau.includes('/')) {
                const [day, month, year] = ngayLamHoKhau.split('/');
                parsedDate = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayLamHoKhau);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedDate = dateAttempt;
                }
            }
        }
        
        // Tạo hộ khẩu mới
        const newHoKhau = new HoKhauCollection({
            soHoKhau,
            hoTenChuHo,
            diaChi,
            ngayLamHoKhau: parsedDate,
            ghiChu: ghiChu || ""
        });
        
        await newHoKhau.save();
        
        // Ghi lại biến đổi nhân khẩu
        const bienDoi = new BienDoiNhanKhauCollection({
            hoKhau: newHoKhau._id,
            loaiThayDoi: 'Thêm mới',
            noiDung: `Thêm mới hộ khẩu số ${soHoKhau}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/hokhau");
    } catch (error) {
        console.error("Error adding household:", error);
        res.render("add-hokhau", { 
            error: "Lỗi khi thêm hộ khẩu: " + error.message,
            formData: req.body
        });
    }
});

// Chi tiết hộ khẩu
app.get("/toquan/hokhau/:id", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const hokhau = await HoKhauCollection.findById(req.params.id);
        if (!hokhau) {
            return res.status(404).send("Hộ khẩu không tồn tại");
        }
        
        // Redirect về trang quản lý hộ khẩu thay vì render view riêng
        // Người dùng có thể click vào hàng hộ khẩu để xem chi tiết các thành viên
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error viewing household:", error);
        res.status(500).send("Error viewing household: " + error.message);
    }
});


// Danh sách nhân khẩu
app.get("/toquan/nhankhau", ensureAuthenticated, ensureToQuan, async (req, res) => {
    // Redirect to the main household management page
    res.redirect("/toquan/hokhau-nhankhau");
});

// Thêm nhân khẩu mới
app.get("/toquan/nhankhau/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Lấy danh sách hộ khẩu cho dropdown
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        res.render("add-nhankhau", { hokhauList });
    } catch (error) {
        console.error("Error loading add form:", error);
        res.status(500).send("Error loading form: " + error.message);
    }
});

app.post("/toquan/nhankhau/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { 
            hoTen, biDanh, ngaySinh, gioiTinh, noiSinh, nguyenQuan, 
            danToc, tonGiao, ngheNghiep, noiLamViec, cccd, ngayCap, 
            noiCap, hoKhau, quanHeVoiChuHo, diaChiTruoc, ghiChu 
        } = req.body;
        
        // Validate inputs
        if (!hoTen || !ngaySinh || !gioiTinh || !hoKhau) {
            const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
            return res.render("add-nhankhau", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                hokhauList
            });
        }
        
        // Parse dates
        let parsedNgaySinh = null;
        if (ngaySinh) {
            if (ngaySinh.includes('/')) {
                const [day, month, year] = ngaySinh.split('/');
                parsedNgaySinh = new Date(year, month - 1, day);
            } else {
                parsedNgaySinh = new Date(ngaySinh);
            }
        }
        
        let parsedNgayCap = null;
        if (ngayCap) {
            if (ngayCap.includes('/')) {
                const [day, month, year] = ngayCap.split('/');
                parsedNgayCap = new Date(year, month - 1, day);
            } else {
                parsedNgayCap = new Date(ngayCap);
            }
        }
        
        // Tạo nhân khẩu mới
        const newNhanKhau = new NhanKhauCollection({
            hoTen,
            biDanh: biDanh || "",
            ngaySinh: parsedNgaySinh,
            gioiTinh,
            noiSinh: noiSinh || "",
            nguyenQuan: nguyenQuan || "",
            danToc: danToc || "",
            tonGiao: tonGiao || "",
            ngheNghiep: ngheNghiep || "",
            noiLamViec: noiLamViec || "",
            cccd: cccd || "",
            ngayCap: parsedNgayCap,
            noiCap: noiCap || "",
            hoKhau,
            quanHeVoiChuHo: quanHeVoiChuHo || "",
            ngayDangKyThuongTru: new Date(),
            diaChiTruoc: diaChiTruoc || "",
            ghiChu: ghiChu || ""
        });
        
        await newNhanKhau.save();
        
        // Ghi lại biến đổi nhân khẩu
        const hokhauInfo = await HoKhauCollection.findById(hoKhau);
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: newNhanKhau._id,
            hoKhau: hoKhau,
            loaiThayDoi: 'Thêm mới',
            noiDung: `Thêm mới nhân khẩu ${hoTen} vào hộ khẩu số ${hokhauInfo.soHoKhau}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/nhankhau");
    } catch (error) {
        console.error("Error adding resident:", error);
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        res.render("add-nhankhau", { 
            error: "Lỗi khi thêm nhân khẩu: " + error.message,
            formData: req.body,
            hokhauList
        });
    }
});

// Quản lý tạm trú, tạm vắng
app.get("/toquan/tamtrutamvang", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamTruList = await TamTruCollection.find()
            .populate('nhanKhau')
            .sort({ tuNgay: -1 });
            
        const tamVangList = await TamVangCollection.find()
            .populate('nhanKhau')
            .sort({ tuNgay: -1 });
            
        res.render("tamtrutamvang", { tamTruList, tamVangList });
    } catch (error) {
        console.error("Error loading temporary residence data:", error);
        res.status(500).send("Error loading data: " + error.message);
    }
});

// Đăng ký tạm trú
app.get("/toquan/tamtru/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamtru", { nhankhauList });
    } catch (error) {
        console.error("Error loading form:", error);
        res.status(500).send("Error loading form: " + error.message);
    }
});

app.post("/toquan/tamtru/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { nhanKhau, diaChiTamTru, tuNgay, denNgay, lyDo } = req.body;
        
        // Validate inputs
        if (!nhanKhau || !diaChiTamTru || !tuNgay || !denNgay) {
            const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
            return res.render("add-tamtru", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                nhankhauList
            });
        }
        
        // Parse dates
        let parsedTuNgay = null;
        if (tuNgay) {
            if (tuNgay.includes('/')) {
                const [day, month, year] = tuNgay.split('/');
                parsedTuNgay = new Date(year, month - 1, day);
            } else {
                parsedTuNgay = new Date(tuNgay);
            }
        }
        
        let parsedDenNgay = null;
        if (denNgay) {
            if (denNgay.includes('/')) {
                const [day, month, year] = denNgay.split('/');
                parsedDenNgay = new Date(year, month - 1, day);
            } else {
                parsedDenNgay = new Date(denNgay);
            }
        }
        
        // Tạo đăng ký tạm trú mới
        const newTamTru = new TamTruCollection({
            nhanKhau,
            diaChiTamTru,
            tuNgay: parsedTuNgay,
            denNgay: parsedDenNgay,
            lyDo: lyDo || "",
            trangThai: 'Đã duyệt'
        });
        
        await newTamTru.save();
        
        // Ghi lại biến đổi nhân khẩu
        const nhankhauInfo = await NhanKhauCollection.findById(nhanKhau);
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: nhanKhau,
            hoKhau: nhankhauInfo.hoKhau,
            loaiThayDoi: 'Tạm trú',
            noiDung: `Đăng ký tạm trú cho ${nhankhauInfo.hoTen} từ ${tuNgay} đến ${denNgay}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error adding temporary residence:", error);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamtru", { 
            error: "Lỗi khi thêm tạm trú: " + error.message,
            formData: req.body,
            nhankhauList
        });
    }
});

// Thống kê dân cư
app.get("/toquan/thongke", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Thống kê tổng số
        const totalHoKhau = await HoKhauCollection.countDocuments();
        const totalNhanKhau = await NhanKhauCollection.countDocuments();
        const totalTamTru = await TamTruCollection.countDocuments({ trangThai: 'Đã duyệt' });
        const totalTamVang = await TamVangCollection.countDocuments({ trangThai: 'Đã duyệt' });
        
        // Thống kê giới tính
        const maleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nam' });
        const femaleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nữ' });
        
        // Thống kê theo độ tuổi
        const currentYear = new Date().getFullYear();
        
        // Dưới 18 tuổi
        const under18Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { $gt: new Date(`${currentYear-18}-01-01`) }
        });
        
        // Từ 18 đến 60 tuổi
        const adult18to60Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { 
                $lte: new Date(`${currentYear-18}-01-01`),
                $gt: new Date(`${currentYear-60}-01-01`)
            }
        });
        
        // Trên 60 tuổi
        const over60Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { $lte: new Date(`${currentYear-60}-01-01`) }
        });
        
        // Biến động nhân khẩu theo tháng
        const monthLabels = [];
        const populationChanges = [];
        
        // Tính toán cho 6 tháng gần nhất
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            const monthYear = `${date.getMonth()+1}/${date.getFullYear()}`;
            monthLabels.push(monthYear);
            
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const changes = await BienDoiNhanKhauCollection.countDocuments({
                ngayThayDoi: {
                    $gte: startOfMonth,
                    $lte: endOfMonth
                }
            });
            
            populationChanges.push(changes);
        }
        
        res.render("thongke-dancu", {
            totalHoKhau,
            totalNhanKhau,
            totalTamTru,
            totalTamVang,
            maleCount,
            femaleCount,
            under18Count,
            adult18to60Count,
            over60Count,
            monthLabels,
            populationChanges
        });
    } catch (error) {
        console.error("Error generating statistics:", error);
        res.status(500).send("Error generating statistics: " + error.message);
    }
});

// Truy vấn và tìm kiếm
app.get("/toquan/truyvan", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Lấy tất cả các tham số tìm kiếm
        const { hoTen, cccd, soHoKhau, diaChi } = req.query;
        
        let nhankhauResults = [];
        let hokhauResults = [];
        
        // Nếu có tham số tìm kiếm
        if (hoTen || cccd || soHoKhau || diaChi) {
            let nhankhauQuery = {};
            let hokhauQuery = {};
            
            // Xây dựng query nhân khẩu
            if (hoTen) {
                nhankhauQuery.hoTen = { $regex: hoTen, $options: 'i' };
            }
            
            if (cccd) {
                nhankhauQuery.cccd = { $regex: cccd, $options: 'i' };
            }
            
            // Xây dựng query hộ khẩu
            if (soHoKhau) {
                hokhauQuery.soHoKhau = { $regex: soHoKhau, $options: 'i' };
            }
            
            if (diaChi) {
                hokhauQuery.diaChi = { $regex: diaChi, $options: 'i' };
            }
            
            // Thực hiện tìm kiếm
            if (Object.keys(nhankhauQuery).length > 0) {
                nhankhauResults = await NhanKhauCollection.find(nhankhauQuery)
                    .populate('hoKhau')
                    .limit(50);
            }
            
            if (Object.keys(hokhauQuery).length > 0) {
                hokhauResults = await HoKhauCollection.find(hokhauQuery)
                    .limit(50);
                    
                // Nếu tìm thấy hộ khẩu, lấy thêm nhân khẩu trong các hộ đó
                if (hokhauResults.length > 0 && !hoTen && !cccd) {
                    const hokhauIds = hokhauResults.map(hk => hk._id);
                    const nhankhauInHokhau = await NhanKhauCollection.find({
                        hoKhau: { $in: hokhauIds }
                    }).populate('hoKhau');
                    
                    // Thêm vào kết quả nhân khẩu nếu chưa có
                    for (const nk of nhankhauInHokhau) {
                        if (!nhankhauResults.some(item => item._id.toString() === nk._id.toString())) {
                            nhankhauResults.push(nk);
                        }
                    }
                }
            }
        }
        
        res.render("truyvan", {
            nhankhauResults,
            hokhauResults,
            query: req.query
        });
    } catch (error) {
        console.error("Error searching:", error);
        res.status(500).send("Error searching: " + error.message);
    }
});

// Biến đổi nhân khẩu
app.get("/toquan/biendoi", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Tìm kiếm theo khoảng thời gian
        const { from, to, type } = req.query;
        
        let query = {};
        
        // Lọc theo loại thay đổi
        if (type && type !== 'all') {
            query.loaiThayDoi = type;
        }
        
        // Lọc theo khoảng thời gian
        if (from || to) {
            query.ngayThayDoi = {};
            
            if (from) {
                let fromDate;
                if (from.includes('/')) {
                    const [day, month, year] = from.split('/');
                    fromDate = new Date(year, month - 1, day);
                } else {
                    fromDate = new Date(from);
                }
                query.ngayThayDoi.$gte = fromDate;
            }
            
            if (to) {
                let toDate;
                if (to.includes('/')) {
                    const [day, month, year] = to.split('/');
                    toDate = new Date(year, month - 1, day);
                    // Đặt giờ là cuối ngày
                    toDate.setHours(23, 59, 59, 999);
                } else {
                    toDate = new Date(to);
                    toDate.setHours(23, 59, 59, 999);
                }
                query.ngayThayDoi.$lte = toDate;
            }
        }
        
        // Lấy danh sách biến đổi nhân khẩu
        const bienDoiList = await BienDoiNhanKhauCollection.find(query)
            .populate('nhanKhau')
            .populate('hoKhau')
            .sort({ ngayThayDoi: -1 });
        
        res.render("biendoi-nhankhau", {
            bienDoiList,
            query: req.query
        });
    } catch (error) {
        console.error("Error loading population changes:", error);
        res.status(500).send("Error loading population changes: " + error.message);
    }
});
app.get("/toquan/hokhau-nhankhau", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Lấy danh sách hộ khẩu để hiển thị
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        
        // Count members for each household
        const hokhauWithMembers = [];
        
        for (const hokhau of hokhauList) {
            // Count residents in this household
            const memberCount = await NhanKhauCollection.countDocuments({ hoKhau: hokhau._id });
            
            // Get list of residents in this household
            const members = await NhanKhauCollection.find({ hoKhau: hokhau._id }).sort({ quanHeVoiChuHo: 1 });
            
            // Add both to the household object
            hokhauWithMembers.push({
                ...hokhau.toObject(),
                memberCount,
                members
            });
        }
        
        // Lấy tất cả nhân khẩu với thông tin hộ khẩu
        const nhankhauList = await NhanKhauCollection.find()
            .populate('hoKhau')
            .sort({ hoTen: 1 });
        
        // Lấy dữ liệu tạm trú tạm vắng
        const tamTruList = await TamTruCollection.find()
            .populate('nhanKhau')
            .sort({ tuNgay: -1 });
            
        const tamVangList = await TamVangCollection.find()
            .populate('nhanKhau')
            .sort({ tuNgay: -1 });
        
        res.render("hokhau-nhankhau", {
            totalHoKhau: hokhauList.length,
            totalNhanKhau: nhankhauList.length,
            hokhauList: hokhauWithMembers,
            nhankhauList,
            tamTruList,
            tamVangList
        });
    } catch (error) {
        console.error("Error loading household management:", error);
        res.status(500).send("Error loading page: " + error.message);
    }
});
// Route trang thêm hộ khẩu
app.get("/toquan/hokhau/add", ensureAuthenticated, ensureToQuan, (req, res) => {
    res.render("add-hokhau");
});

// Route xử lý thêm hộ khẩu
app.post("/toquan/hokhau/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { soHoKhau, hoTenChuHo, diaChi, ngayLamHoKhau, khuVuc, ghiChu } = req.body;
        
        // Validate inputs
        if (!soHoKhau || !hoTenChuHo || !diaChi) {
            return res.render("add-hokhau", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                formData: req.body
            });
        }
        
        // Kiểm tra số hộ khẩu đã tồn tại chưa
        const existingHoKhau = await HoKhauCollection.findOne({ soHoKhau });
        if (existingHoKhau) {
            return res.render("add-hokhau", { 
                error: "Số hộ khẩu đã tồn tại",
                formData: req.body
            });
        }
        
        // Xử lý ngày nếu nhập vào định dạng dd/mm/yyyy
        let parsedDate = new Date();
        if (ngayLamHoKhau) {
            if (ngayLamHoKhau.includes('/')) {
                const [day, month, year] = ngayLamHoKhau.split('/');
                parsedDate = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayLamHoKhau);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedDate = dateAttempt;
                }
            }
        }
        
        // Tạo hộ khẩu mới
        const newHoKhau = new HoKhauCollection({
            soHoKhau,
            hoTenChuHo,
            diaChi,
            ngayLamHoKhau: parsedDate,
            ghiChu: ghiChu || ""
        });
        
        await newHoKhau.save();
        
        // Ghi lại biến đổi nhân khẩu
        const bienDoi = new BienDoiNhanKhauCollection({
            hoKhau: newHoKhau._id,
            loaiThayDoi: 'Thêm mới',
            ngayThayDoi: new Date(),
            noiDung: `Thêm mới hộ khẩu số ${soHoKhau}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        // Redirect to the newly created household
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error adding household:", error);
        res.render("add-hokhau", { 
            error: "Lỗi khi thêm hộ khẩu: " + error.message,
            formData: req.body
        });
    }
});

// Route trang thêm nhân khẩu
app.get("/toquan/nhankhau/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Lấy danh sách hộ khẩu cho dropdown
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        res.render("add-nhankhau", { hokhauList });
    } catch (error) {
        console.error("Error loading add form:", error);
        res.status(500).send("Error loading form: " + error.message);
    }
});

// Route xử lý thêm nhân khẩu
app.post("/toquan/nhankhau/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { 
            hoTen, biDanh, ngaySinh, gioiTinh, noiSinh, nguyenQuan, 
            danToc, tonGiao, ngheNghiep, noiLamViec, cccd, ngayCap, 
            noiCap, hoKhau, quanHeVoiChuHo, ngayDangKyThuongTru, diaChiTruoc, ghiChu 
        } = req.body;
        
        // Lấy danh sách hộ khẩu cho form (trong trường hợp xảy ra lỗi)
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        
        // Validate inputs
        if (!hoTen || !ngaySinh || !gioiTinh || !hoKhau || !quanHeVoiChuHo) {
            return res.render("add-nhankhau", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                hokhauList
            });
        }
        
        // Xử lý ngày sinh, ngày cấp, ngày đăng ký thường trú
        let parsedNgaySinh = null;
        if (ngaySinh) {
            if (ngaySinh.includes('/')) {
                const [day, month, year] = ngaySinh.split('/');
                parsedNgaySinh = new Date(year, month - 1, day);
            } else {
                parsedNgaySinh = new Date(ngaySinh);
            }
        }
        
        let parsedNgayCap = null;
        if (ngayCap) {
            if (ngayCap.includes('/')) {
                const [day, month, year] = ngayCap.split('/');
                parsedNgayCap = new Date(year, month - 1, day);
            } else {
                parsedNgayCap = new Date(ngayCap);
            }
        }
        
        let parsedNgayDangKyThuongTru = new Date();
        if (ngayDangKyThuongTru) {
            if (ngayDangKyThuongTru.includes('/')) {
                const [day, month, year] = ngayDangKyThuongTru.split('/');
                parsedNgayDangKyThuongTru = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayDangKyThuongTru);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedNgayDangKyThuongTru = dateAttempt;
                }
            }
        }
        
        // Tạo nhân khẩu mới
        const newNhanKhau = new NhanKhauCollection({
            hoTen,
            biDanh: biDanh || "",
            ngaySinh: parsedNgaySinh,
            gioiTinh,
            noiSinh: noiSinh || "",
            nguyenQuan: nguyenQuan || "",
            danToc: danToc || "Kinh",
            tonGiao: tonGiao || "Không",
            ngheNghiep: ngheNghiep || "",
            noiLamViec: noiLamViec || "",
            cccd: cccd || "",
            ngayCap: parsedNgayCap,
            noiCap: noiCap || "",
            hoKhau,
            quanHeVoiChuHo,
            ngayDangKyThuongTru: parsedNgayDangKyThuongTru,
            diaChiTruoc: diaChiTruoc || "",
            ghiChu: ghiChu || ""
        });
        
        await newNhanKhau.save();
        
        // Lấy thông tin hộ khẩu
        const hokhauInfo = await HoKhauCollection.findById(hoKhau);
        
        // Ghi lại biến đổi nhân khẩu
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: newNhanKhau._id,
            hoKhau: hoKhau,
            loaiThayDoi: 'Thêm mới',
            ngayThayDoi: new Date(),
            noiDung: `Thêm mới nhân khẩu ${hoTen} vào hộ khẩu số ${hokhauInfo.soHoKhau}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error adding resident:", error);
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        res.render("add-nhankhau", { 
            error: "Lỗi khi thêm nhân khẩu: " + error.message,
            formData: req.body,
            hokhauList
        });
    }
});
app.get("/toquan/nhankhau/:id", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const nhankhau = await NhanKhauCollection.findById(req.params.id).populate('hoKhau');
        
        if (!nhankhau) {
            return res.status(404).send("Nhân khẩu không tồn tại");
        }
        
        // Redirect về trang quản lý hộ khẩu, tab nhân khẩu
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error viewing resident:", error);
        res.status(500).send("Error viewing resident: " + error.message);
    }
});

// Chỉnh sửa nhân khẩu - GET
app.get("/toquan/nhankhau/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const nhankhau = await NhanKhauCollection.findById(req.params.id);
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        
        if (!nhankhau) {
            return res.status(404).send("Nhân khẩu không tồn tại");
        }
        
        // Format dates
        const formData = {
            ...nhankhau.toObject(),
            ngaySinh: nhankhau.ngaySinh ? 
                `${nhankhau.ngaySinh.getDate()}/${nhankhau.ngaySinh.getMonth() + 1}/${nhankhau.ngaySinh.getFullYear()}` : '',
            ngayCap: nhankhau.ngayCap ? 
                `${nhankhau.ngayCap.getDate()}/${nhankhau.ngayCap.getMonth() + 1}/${nhankhau.ngayCap.getFullYear()}` : '',
            ngayDangKyThuongTru: nhankhau.ngayDangKyThuongTru ? 
                `${nhankhau.ngayDangKyThuongTru.getDate()}/${nhankhau.ngayDangKyThuongTru.getMonth() + 1}/${nhankhau.ngayDangKyThuongTru.getFullYear()}` : '',
            hoKhau: nhankhau.hoKhau.toString()
        };
        
        res.render("add-nhankhau", { 
            formData,
            hokhauList,
            isEditing: true 
        });
    } catch (error) {
        console.error("Error loading edit form:", error);
        res.status(500).send("Error loading edit form: " + error.message);
    }
});

// Chỉnh sửa nhân khẩu - POST
app.post("/toquan/nhankhau/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { 
            hoTen, biDanh, ngaySinh, gioiTinh, noiSinh, nguyenQuan, 
            danToc, tonGiao, ngheNghiep, noiLamViec, cccd, ngayCap, 
            noiCap, hoKhau, quanHeVoiChuHo, ngayDangKyThuongTru, diaChiTruoc, ghiChu 
        } = req.body;
        
        const nhanKhauId = req.params.id;
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        
        // Validate inputs
        if (!hoTen || !ngaySinh || !gioiTinh || !hoKhau || !quanHeVoiChuHo) {
            return res.render("add-nhankhau", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                hokhauList,
                isEditing: true
            });
        }
        
        // Parse dates
        let parsedNgaySinh = null;
        if (ngaySinh) {
            if (ngaySinh.includes('/')) {
                const [day, month, year] = ngaySinh.split('/');
                parsedNgaySinh = new Date(year, month - 1, day);
            } else {
                parsedNgaySinh = new Date(ngaySinh);
            }
        }
        
        let parsedNgayCap = null;
        if (ngayCap) {
            if (ngayCap.includes('/')) {
                const [day, month, year] = ngayCap.split('/');
                parsedNgayCap = new Date(year, month - 1, day);
            } else {
                parsedNgayCap = new Date(ngayCap);
            }
        }
        
        let parsedNgayDangKyThuongTru = new Date();
        if (ngayDangKyThuongTru) {
            if (ngayDangKyThuongTru.includes('/')) {
                const [day, month, year] = ngayDangKyThuongTru.split('/');
                parsedNgayDangKyThuongTru = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayDangKyThuongTru);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedNgayDangKyThuongTru = dateAttempt;
                }
            }
        }
        
        // Cập nhật nhân khẩu
        const updatedNhanKhau = await NhanKhauCollection.findByIdAndUpdate(
            nhanKhauId,
            {
                hoTen,
                biDanh: biDanh || "",
                ngaySinh: parsedNgaySinh,
                gioiTinh,
                noiSinh: noiSinh || "",
                nguyenQuan: nguyenQuan || "",
                danToc: danToc || "Kinh",
                tonGiao: tonGiao || "Không",
                ngheNghiep: ngheNghiep || "",
                noiLamViec: noiLamViec || "",
                cccd: cccd || "",
                ngayCap: parsedNgayCap,
                noiCap: noiCap || "",
                hoKhau,
                quanHeVoiChuHo,
                ngayDangKyThuongTru: parsedNgayDangKyThuongTru,
                diaChiTruoc: diaChiTruoc || "",
                ghiChu: ghiChu || ""
            },
            { new: true }
        );
        
        if (!updatedNhanKhau) {
            return res.status(404).send("Nhân khẩu không tồn tại");
        }
        
        // Lấy thông tin hộ khẩu
        const hokhauInfo = await HoKhauCollection.findById(hoKhau);
        
        // Ghi lại biến đổi nhân khẩu
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: nhanKhauId,
            hoKhau: hoKhau,
            loaiThayDoi: 'Chỉnh sửa',
            ngayThayDoi: new Date(),
            noiDung: `Chỉnh sửa thông tin nhân khẩu ${hoTen}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error updating resident:", error);
        const hokhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        res.render("add-nhankhau", { 
            error: "Lỗi khi cập nhật nhân khẩu: " + error.message,
            formData: req.body,
            hokhauList,
            isEditing: true
        });
    }
});

// Xóa nhân khẩu
app.get("/toquan/nhankhau/:id/delete", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const nhanKhauId = req.params.id;
        
        // Kiểm tra xem nhân khẩu có tồn tại không
        const nhanKhau = await NhanKhauCollection.findById(nhanKhauId).populate('hoKhau');
        if (!nhanKhau) {
            return res.status(404).send("Nhân khẩu không tồn tại");
        }
        
        // Ghi lại biến đổi nhân khẩu trước khi xóa
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: nhanKhauId,
            hoKhau: nhanKhau.hoKhau._id,
            loaiThayDoi: 'Xóa',
            ngayThayDoi: new Date(),
            noiDung: `Xóa nhân khẩu ${nhanKhau.hoTen} khỏi hộ khẩu số ${nhanKhau.hoKhau.soHoKhau}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        // Xóa nhân khẩu
        await NhanKhauCollection.findByIdAndDelete(nhanKhauId);
        
        // Redirect về trang quản lý hộ khẩu
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error deleting resident:", error);
        res.status(500).send("Error deleting resident: " + error.message);
    }
});
app.get("/toquan/hokhau/:id/delete", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const hoKhauId = req.params.id;
        
        // Kiểm tra xem hộ khẩu có tồn tại không
        const hoKhau = await HoKhauCollection.findById(hoKhauId);
        if (!hoKhau) {
            return res.status(404).send("Hộ khẩu không tồn tại");
        }
        
        // Lấy danh sách nhân khẩu trong hộ khẩu để ghi log
        const nhankhauList = await NhanKhauCollection.find({ hoKhau: hoKhauId });
        
        // Ghi lại biến đổi cho từng nhân khẩu bị xóa
        for (const nhankhau of nhankhauList) {
            const bienDoi = new BienDoiNhanKhauCollection({
                nhanKhau: nhankhau._id,
                hoKhau: hoKhauId,
                loaiThayDoi: 'Xóa',
                ngayThayDoi: new Date(),
                noiDung: `Xóa nhân khẩu ${nhankhau.hoTen} do xóa hộ khẩu số ${hoKhau.soHoKhau}`,
                nguoiThucHien: req.session.name
            });
            await bienDoi.save();
        }
        
        // Xóa tất cả nhân khẩu trong hộ khẩu này trước
        await NhanKhauCollection.deleteMany({ hoKhau: hoKhauId });
        
        // Xóa các bản ghi tạm trú, tạm vắng liên quan đến các nhân khẩu trong hộ khẩu này
        const nhankhauIds = nhankhauList.map(nk => nk._id);
        if (nhankhauIds.length > 0) {
            await TamTruCollection.deleteMany({ nhanKhau: { $in: nhankhauIds } });
            await TamVangCollection.deleteMany({ nhanKhau: { $in: nhankhauIds } });
        }
        
        // Ghi lại biến đổi cho hộ khẩu
        const bienDoi = new BienDoiNhanKhauCollection({
            hoKhau: hoKhauId,
            loaiThayDoi: 'Xóa',
            ngayThayDoi: new Date(),
            noiDung: `Xóa hộ khẩu số ${hoKhau.soHoKhau} và ${nhankhauList.length} nhân khẩu`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        // Xóa hộ khẩu
        await HoKhauCollection.findByIdAndDelete(hoKhauId);
        
        console.log(`Đã xóa hộ khẩu ${hoKhau.soHoKhau} và ${nhankhauList.length} nhân khẩu`);
        
        // Redirect về trang quản lý hộ khẩu
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error deleting household:", error);
        res.status(500).send("Error deleting household: " + error.message);
    }
});

// Chỉnh sửa hộ khẩu - GET
app.get("/toquan/hokhau/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const hoKhau = await HoKhauCollection.findById(req.params.id);
        
        if (!hoKhau) {
            return res.status(404).send("Hộ khẩu không tồn tại");
        }
        
        // Format ngày để hiển thị trong form
        const formData = {
            ...hoKhau.toObject(),
            ngayLamHoKhau: hoKhau.ngayLamHoKhau ? 
                `${hoKhau.ngayLamHoKhau.getDate()}/${hoKhau.ngayLamHoKhau.getMonth() + 1}/${hoKhau.ngayLamHoKhau.getFullYear()}` : ''
        };
        
        res.render("add-hokhau", { 
            formData,
            isEditing: true 
        });
    } catch (error) {
        console.error("Error loading edit form:", error);
        res.status(500).send("Error loading edit form: " + error.message);
    }
});

// Chỉnh sửa hộ khẩu - POST
app.post("/toquan/hokhau/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { soHoKhau, hoTenChuHo, diaChi, ngayLamHoKhau, khuVuc, ghiChu } = req.body;
        const hoKhauId = req.params.id;
        
        // Validate inputs
        if (!soHoKhau || !hoTenChuHo || !diaChi) {
            return res.render("add-hokhau", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                formData: req.body,
                isEditing: true
            });
        }
        
        // Kiểm tra số hộ khẩu đã tồn tại chưa (trừ chính nó)
        const existingHoKhau = await HoKhauCollection.findOne({ 
            soHoKhau,
            _id: { $ne: hoKhauId }
        });
        if (existingHoKhau) {
            return res.render("add-hokhau", { 
                error: "Số hộ khẩu đã tồn tại",
                formData: req.body,
                isEditing: true
            });
        }
        
        // Xử lý ngày
        let parsedDate = new Date();
        if (ngayLamHoKhau) {
            if (ngayLamHoKhau.includes('/')) {
                const [day, month, year] = ngayLamHoKhau.split('/');
                parsedDate = new Date(year, month - 1, day);
            } else {
                const dateAttempt = new Date(ngayLamHoKhau);
                if (!isNaN(dateAttempt.getTime())) {
                    parsedDate = dateAttempt;
                }
            }
        }
        
        // Cập nhật hộ khẩu
        const updatedHoKhau = await HoKhauCollection.findByIdAndUpdate(
            hoKhauId,
            {
                soHoKhau,
                hoTenChuHo,
                diaChi,
                ngayLamHoKhau: parsedDate,
                khuVuc: khuVuc || "",
                ghiChu: ghiChu || ""
            },
            { new: true }
        );
        
        if (!updatedHoKhau) {
            return res.status(404).send("Hộ khẩu không tồn tại");
        }
        
        // Ghi lại biến đổi
        const bienDoi = new BienDoiNhanKhauCollection({
            hoKhau: hoKhauId,
            loaiThayDoi: 'Chỉnh sửa',
            ngayThayDoi: new Date(),
            noiDung: `Chỉnh sửa thông tin hộ khẩu số ${soHoKhau}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/hokhau-nhankhau");
    } catch (error) {
        console.error("Error updating household:", error);
        res.render("add-hokhau", { 
            error: "Lỗi khi cập nhật hộ khẩu: " + error.message,
            formData: req.body,
            isEditing: true
        });
    }
});

app.get("/toquan/tamtrutamvang", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamTruList = await TamTruCollection.find()
            .populate('nhanKhau')
            .sort({ tuNgay: -1 });
            
        const tamVangList = await TamVangCollection.find()
            .populate('nhanKhau')
            .sort({ tuNgay: -1 });
            
        res.render("tamtrutamvang", { tamTruList, tamVangList });
    } catch (error) {
        console.error("Error loading temporary residence data:", error);
        res.status(500).send("Error loading data: " + error.message);
    }
});

// Thêm tạm trú mới
app.get("/toquan/tamtru/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamtru", { nhankhauList });
    } catch (error) {
        console.error("Error loading form:", error);
        res.status(500).send("Error loading form: " + error.message);
    }
});


app.post("/toquan/tamtru/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { nhanKhau, diaChiTamTru, tuNgay, denNgay, lyDo, trangThai } = req.body;
        
        // Validate inputs
        if (!nhanKhau || !diaChiTamTru || !tuNgay || !denNgay) {
            const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
            return res.render("add-tamtru", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                nhankhauList
            });
        }
        
        // Parse dates
        let parsedTuNgay = null;
        if (tuNgay) {
            if (tuNgay.includes('/')) {
                const [day, month, year] = tuNgay.split('/');
                parsedTuNgay = new Date(year, month - 1, day);
            } else {
                parsedTuNgay = new Date(tuNgay);
            }
        }
        
        let parsedDenNgay = null;
        if (denNgay) {
            if (denNgay.includes('/')) {
                const [day, month, year] = denNgay.split('/');
                parsedDenNgay = new Date(year, month - 1, day);
            } else {
                parsedDenNgay = new Date(denNgay);
            }
        }
        
        // Tạo đăng ký tạm trú mới
        const newTamTru = new TamTruCollection({
            nhanKhau,
            diaChiTamTru,
            tuNgay: parsedTuNgay,
            denNgay: parsedDenNgay,
            lyDo: lyDo || "",
            trangThai: trangThai || 'Đã duyệt'
        });
        
        await newTamTru.save();
        
        // Ghi lại biến đổi nhân khẩu
        const nhankhauInfo = await NhanKhauCollection.findById(nhanKhau);
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: nhanKhau,
            hoKhau: nhankhauInfo.hoKhau,
            loaiThayDoi: 'Tạm trú',
            ngayThayDoi: new Date(),
            noiDung: `Đăng ký tạm trú cho ${nhankhauInfo.hoTen} từ ${tuNgay} đến ${denNgay}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error adding temporary residence:", error);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamtru", { 
            error: "Lỗi khi thêm tạm trú: " + error.message,
            formData: req.body,
            nhankhauList
        });
    }
});

// Chi tiết tạm trú
app.get("/toquan/tamtru/:id", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamTru = await TamTruCollection.findById(req.params.id).populate('nhanKhau');
        
        if (!tamTru) {
            return res.status(404).send("Không tìm thấy thông tin tạm trú");
        }
        
        res.render("tamtru-detail", { tamTru });
    } catch (error) {
        console.error("Error viewing tamtru:", error);
        res.status(500).send("Error viewing data: " + error.message);
    }
});

// Chỉnh sửa tạm trú
app.get("/toquan/tamtru/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamTru = await TamTruCollection.findById(req.params.id);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        
        if (!tamTru) {
            return res.status(404).send("Không tìm thấy thông tin tạm trú");
        }
        
        // Format dates
        const tuNgay = tamTru.tuNgay 
            ? `${tamTru.tuNgay.getDate()}/${tamTru.tuNgay.getMonth() + 1}/${tamTru.tuNgay.getFullYear()}`
            : '';
            
        const denNgay = tamTru.denNgay 
            ? `${tamTru.denNgay.getDate()}/${tamTru.denNgay.getMonth() + 1}/${tamTru.denNgay.getFullYear()}`
            : '';
        
        const formData = {
            ...tamTru.toObject(),
            tuNgay,
            denNgay,
            nhanKhau: tamTru.nhanKhau.toString()
        };
        
        res.render("add-tamtru", { 
            formData,
            nhankhauList,
            isEditing: true
        });
    } catch (error) {
        console.error("Error editing tamtru:", error);
        res.status(500).send("Error loading edit form: " + error.message);
    }
});

app.post("/toquan/tamtru/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { nhanKhau, diaChiTamTru, tuNgay, denNgay, lyDo, trangThai } = req.body;
        
        // Validate inputs
        if (!nhanKhau || !diaChiTamTru || !tuNgay || !denNgay) {
            const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
            return res.render("add-tamtru", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                nhankhauList,
                isEditing: true
            });
        }
        
        // Parse dates
        let parsedTuNgay = null;
        if (tuNgay) {
            if (tuNgay.includes('/')) {
                const [day, month, year] = tuNgay.split('/');
                parsedTuNgay = new Date(year, month - 1, day);
            } else {
                parsedTuNgay = new Date(tuNgay);
            }
        }
        
        let parsedDenNgay = null;
        if (denNgay) {
            if (denNgay.includes('/')) {
                const [day, month, year] = denNgay.split('/');
                parsedDenNgay = new Date(year, month - 1, day);
            } else {
                parsedDenNgay = new Date(denNgay);
            }
        }
        
        // Update tạm trú
        const updatedTamTru = await TamTruCollection.findByIdAndUpdate(
            req.params.id,
            {
                nhanKhau,
                diaChiTamTru,
                tuNgay: parsedTuNgay,
                denNgay: parsedDenNgay,
                lyDo: lyDo || "",
                trangThai: trangThai || 'Đã duyệt'
            },
            { new: true }
        );
        
        if (!updatedTamTru) {
            return res.status(404).send("Không tìm thấy thông tin tạm trú");
        }
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error updating tamtru:", error);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamtru", { 
            error: "Lỗi khi cập nhật tạm trú: " + error.message,
            formData: req.body,
            nhankhauList,
            isEditing: true
        });
    }
});

// Xóa tạm trú
app.get("/toquan/tamtru/:id/delete", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamTru = await TamTruCollection.findById(req.params.id).populate('nhanKhau');
        
        if (!tamTru) {
            return res.status(404).send("Không tìm thấy thông tin tạm trú");
        }
        
        // Ghi lại biến đổi nhân khẩu trước khi xóa
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: tamTru.nhanKhau._id,
            loaiThayDoi: 'Tạm trú',
            ngayThayDoi: new Date(),
            noiDung: `Xóa đăng ký tạm trú của ${tamTru.nhanKhau.hoTen}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        // Xóa tạm trú
        await TamTruCollection.findByIdAndDelete(req.params.id);
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error deleting tamtru:", error);
        res.status(500).send("Error deleting record: " + error.message);
    }
});

// Thêm tạm vắng mới
app.get("/toquan/tamvang/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamvang", { nhankhauList });
    } catch (error) {
        console.error("Error loading form:", error);
        res.status(500).send("Error loading form: " + error.message);
    }
});

app.post("/toquan/tamvang/add", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { nhanKhau, noiTamTru, tuNgay, denNgay, lyDo, trangThai } = req.body;
        
        // Validate inputs
        if (!nhanKhau || !noiTamTru || !tuNgay || !denNgay) {
            const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
            return res.render("add-tamvang", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                nhankhauList
            });
        }
        
        // Parse dates
        let parsedTuNgay = null;
        if (tuNgay) {
            if (tuNgay.includes('/')) {
                const [day, month, year] = tuNgay.split('/');
                parsedTuNgay = new Date(year, month - 1, day);
            } else {
                parsedTuNgay = new Date(tuNgay);
            }
        }
        
        let parsedDenNgay = null;
        if (denNgay) {
            if (denNgay.includes('/')) {
                const [day, month, year] = denNgay.split('/');
                parsedDenNgay = new Date(year, month - 1, day);
            } else {
                parsedDenNgay = new Date(denNgay);
            }
        }
        
        // Tạo đăng ký tạm vắng mới
        const newTamVang = new TamVangCollection({
            nhanKhau,
            noiTamTru,
            tuNgay: parsedTuNgay,
            denNgay: parsedDenNgay,
            lyDo: lyDo || "",
            trangThai: trangThai || 'Đã duyệt'
        });
        
        await newTamVang.save();
        
        // Ghi lại biến đổi nhân khẩu
        const nhankhauInfo = await NhanKhauCollection.findById(nhanKhau);
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: nhanKhau,
            hoKhau: nhankhauInfo.hoKhau,
            loaiThayDoi: 'Tạm vắng',
            ngayThayDoi: new Date(),
            noiDung: `Đăng ký tạm vắng cho ${nhankhauInfo.hoTen} từ ${tuNgay} đến ${denNgay}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error adding temporary absence:", error);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamvang", { 
            error: "Lỗi khi thêm tạm vắng: " + error.message,
            formData: req.body,
            nhankhauList
        });
    }
});

// Chi tiết tạm vắng
app.get("/toquan/tamvang/:id", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamVang = await TamVangCollection.findById(req.params.id).populate('nhanKhau');
        
        if (!tamVang) {
            return res.status(404).send("Không tìm thấy thông tin tạm vắng");
        }
        
        res.render("tamvang-detail", { tamVang });
    } catch (error) {
        console.error("Error viewing tamvang:", error);
        res.status(500).send("Error viewing data: " + error.message);
    }
});

// Chỉnh sửa tạm vắng
app.get("/toquan/tamvang/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamVang = await TamVangCollection.findById(req.params.id);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        
        if (!tamVang) {
            return res.status(404).send("Không tìm thấy thông tin tạm vắng");
        }
        
        // Format dates
        const tuNgay = tamVang.tuNgay 
            ? `${tamVang.tuNgay.getDate()}/${tamVang.tuNgay.getMonth() + 1}/${tamVang.tuNgay.getFullYear()}`
            : '';
            
        const denNgay = tamVang.denNgay 
            ? `${tamVang.denNgay.getDate()}/${tamVang.denNgay.getMonth() + 1}/${tamVang.denNgay.getFullYear()}`
            : '';
        
        const formData = {
            ...tamVang.toObject(),
            tuNgay,
            denNgay,
            nhanKhau: tamVang.nhanKhau.toString()
        };
        
        res.render("add-tamvang", { 
            formData,
            nhankhauList,
            isEditing: true
        });
    } catch (error) {
        console.error("Error editing tamvang:", error);
        res.status(500).send("Error loading edit form: " + error.message);
    }
});

app.post("/toquan/tamvang/:id/edit", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { nhanKhau, noiTamTru, tuNgay, denNgay, lyDo, trangThai } = req.body;
        
        // Validate inputs
        if (!nhanKhau || !noiTamTru || !tuNgay || !denNgay) {
            const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
            return res.render("add-tamvang", { 
                error: "Vui lòng nhập đầy đủ thông tin bắt buộc",
                formData: req.body,
                nhankhauList,
                isEditing: true
            });
        }
        
        // Parse dates
        let parsedTuNgay = null;
        if (tuNgay) {
            if (tuNgay.includes('/')) {
                const [day, month, year] = tuNgay.split('/');
                parsedTuNgay = new Date(year, month - 1, day);
            } else {
                parsedTuNgay = new Date(tuNgay);
            }
        }
        
        let parsedDenNgay = null;
        if (denNgay) {
            if (denNgay.includes('/')) {
                const [day, month, year] = denNgay.split('/');
                parsedDenNgay = new Date(year, month - 1, day);
            } else {
                parsedDenNgay = new Date(denNgay);
            }
        }
        
        // Update tạm vắng
        const updatedTamVang = await TamVangCollection.findByIdAndUpdate(
            req.params.id,
            {
                nhanKhau,
                noiTamTru,
                tuNgay: parsedTuNgay,
                denNgay: parsedDenNgay,
                lyDo: lyDo || "",
                trangThai: trangThai || 'Đã duyệt'
            },
            { new: true }
        );
        
        if (!updatedTamVang) {
            return res.status(404).send("Không tìm thấy thông tin tạm vắng");
        }
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error updating tamvang:", error);
        const nhankhauList = await NhanKhauCollection.find().sort({ hoTen: 1 });
        res.render("add-tamvang", { 
            error: "Lỗi khi cập nhật tạm vắng: " + error.message,
            formData: req.body,
            nhankhauList,
            isEditing: true
        });
    }
});

// Xóa tạm vắng
app.get("/toquan/tamvang/:id/delete", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamVang = await TamVangCollection.findById(req.params.id).populate('nhanKhau');
        
        if (!tamVang) {
            return res.status(404).send("Không tìm thấy thông tin tạm vắng");
        }
        
        // Ghi lại biến đổi nhân khẩu trước khi xóa
        const bienDoi = new BienDoiNhanKhauCollection({
            nhanKhau: tamVang.nhanKhau._id,
            loaiThayDoi: 'Tạm vắng',
            ngayThayDoi: new Date(),
            noiDung: `Xóa đăng ký tạm vắng của ${tamVang.nhanKhau.hoTen}`,
            nguoiThucHien: req.session.name
        });
        await bienDoi.save();
        
        // Xóa tạm vắng
        await TamVangCollection.findByIdAndDelete(req.params.id);
        
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error deleting tamvang:", error);
        res.status(500).send("Error deleting record: " + error.message);
    }
});

// Thống kê dân cư
app.get("/toquan/thongke", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Thống kê tổng số
        const totalHoKhau = await HoKhauCollection.countDocuments();
        const totalNhanKhau = await NhanKhauCollection.countDocuments();
        const totalTamTru = await TamTruCollection.countDocuments({ trangThai: 'Đã duyệt' });
        const totalTamVang = await TamVangCollection.countDocuments({ trangThai: 'Đã duyệt' });
        
        // Thống kê giới tính
        const maleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nam' });
        const femaleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nữ' });
        
        // Thống kê theo độ tuổi
        const currentYear = new Date().getFullYear();
        
        // Dưới 18 tuổi
        const under18Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { $gt: new Date(`${currentYear-18}-01-01`) }
        });
        
        // Từ 18 đến 60 tuổi
        const adult18to60Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { 
                $lte: new Date(`${currentYear-18}-01-01`),
                $gt: new Date(`${currentYear-60}-01-01`)
            }
        });
        
        // Trên 60 tuổi
        const over60Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { $lte: new Date(`${currentYear-60}-01-01`) }
        });
        
        // Biến động nhân khẩu theo tháng
        const monthLabels = [];
        const populationChanges = [];
        
        // Tính toán cho 6 tháng gần nhất
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            const monthYear = `${date.getMonth()+1}/${date.getFullYear()}`;
            monthLabels.push(monthYear);
            
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const changes = await BienDoiNhanKhauCollection.countDocuments({
                ngayThayDoi: {
                    $gte: startOfMonth,
                    $lte: endOfMonth
                }
            });
            
            populationChanges.push(changes);
        }
        
        res.render("thongke-dancu", {
            totalHoKhau,
            totalNhanKhau,
            totalTamTru,
            totalTamVang,
            maleCount,
            femaleCount,
            under18Count,
            adult18to60Count,
            over60Count,
            monthLabels,
            populationChanges
        });
    } catch (error) {
        console.error("Error generating statistics:", error);
        res.status(500).send("Error generating statistics: " + error.message);
    }
});
app.get("/topho/thongke", ensureAuthenticated, ensureToPho, async (req, res) => {
    try {
        // Thống kê tổng số
        const totalHoKhau = await HoKhauCollection.countDocuments();
        const totalNhanKhau = await NhanKhauCollection.countDocuments();
        const totalTamTru = await TamTruCollection.countDocuments({ trangThai: 'Đã duyệt' });
        const totalTamVang = await TamVangCollection.countDocuments({ trangThai: 'Đã duyệt' });
        
        // Thống kê giới tính
        const maleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nam' });
        const femaleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nữ' });
        
        // Thống kê theo độ tuổi
        const currentYear = new Date().getFullYear();
        
        // Dưới 18 tuổi
        const under18Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { $gt: new Date(`${currentYear-18}-01-01`) }
        });
        
        // Từ 18 đến 60 tuổi
        const adult18to60Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { 
                $lte: new Date(`${currentYear-18}-01-01`),
                $gt: new Date(`${currentYear-60}-01-01`)
            }
        });
        
        // Trên 60 tuổi
        const over60Count = await NhanKhauCollection.countDocuments({
            ngaySinh: { $lte: new Date(`${currentYear-60}-01-01`) }
        });
        
        // Biến động nhân khẩu theo tháng
        const monthLabels = [];
        const populationChanges = [];
        
        // Tính toán cho 6 tháng gần nhất
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            const monthYear = `${date.getMonth()+1}/${date.getFullYear()}`;
            monthLabels.push(monthYear);
            
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const changes = await BienDoiNhanKhauCollection.countDocuments({
                ngayThayDoi: {
                    $gte: startOfMonth,
                    $lte: endOfMonth
                }
            });
            
            populationChanges.push(changes);
        }
        
        res.render("thongke-topho", {
            totalHoKhau,
            totalNhanKhau,
            totalTamTru,
            totalTamVang,
            maleCount,
            femaleCount,
            under18Count,
            adult18to60Count,
            over60Count,
            monthLabels,
            populationChanges
        });
    } catch (error) {
        console.error("Error generating statistics:", error);
        res.status(500).send("Error generating statistics: " + error.message);
    }
});
// Thêm các template mẫu cho trang chi tiết nếu cần
app.get("/toquan/tamtru/:id", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamTru = await TamTruCollection.findById(req.params.id).populate('nhanKhau');
        
        if (!tamTru) {
            return res.status(404).send("Không tìm thấy thông tin tạm trú");
        }
        
        // Nếu chưa có template chi tiết, redirect lại trang chính
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error viewing tamtru:", error);
        res.status(500).send("Error viewing data: " + error.message);
    }
});

app.get("/toquan/tamvang/:id", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const tamVang = await TamVangCollection.findById(req.params.id).populate('nhanKhau');
        
        if (!tamVang) {
            return res.status(404).send("Không tìm thấy thông tin tạm vắng");
        }
        
        // Nếu chưa có template chi tiết, redirect lại trang chính
        res.redirect("/toquan/tamtrutamvang");
    } catch (error) {
        console.error("Error viewing tamvang:", error);
        res.status(500).send("Error viewing data: " + error.message);
    }
});
app.get("/topho/dashboard", ensureAuthenticated, ensureToPho, async (req, res) => {
    try {
        // Lấy số liệu thống kê từ database
        const totalHoKhau = await HoKhauCollection.countDocuments();
        const totalNhanKhau = await NhanKhauCollection.countDocuments();
        const totalTamTru = await TamTruCollection.countDocuments();
        const totalTamVang = await TamVangCollection.countDocuments();
        
        // Thống kê giới tính
        const maleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nam' });
        const femaleCount = await NhanKhauCollection.countDocuments({ gioiTinh: 'Nữ' });
        
        // Lấy dữ liệu biến đổi nhân khẩu gần đây
        const recentChanges = await BienDoiNhanKhauCollection.find()
            .sort({ ngayThayDoi: -1 })
            .limit(5)
            .populate('nhanKhau')
            .populate('hoKhau');
        
        // Truy vấn danh sách căn hộ
        const apartments = await ApartmentCollection.find(); // Thay thế `ApartmentCollection` bằng tên chính xác của collection

        res.render("topho-dashboard", {
            totalHoKhau,
            totalNhanKhau,
            totalTamTru,
            totalTamVang,
            maleCount,
            femaleCount,
            recentChanges,
            apartments // Thêm `apartments` vào dữ liệu được truyền vào view
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Error loading dashboard: " + error.message);
    }
});

function ensureCuDan(req, res, next) {
    if (req.session.role === 'cudan') {
        return next();
    }
    res.status(403).send("Access Denied: Resident privileges required");
}
// Cập nhật route trang chủ cư dân để lấy dữ liệu lịch sử thanh toán thực tế
// Thay đổi route này trong file index.js

app.get("/cudan/dashboard", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        // Thông tin cá nhân cư dân
        const residentInfo = {
            name: req.session.name,
            apartment: "A0101"
        };
        
        // Lấy dữ liệu thực tế các khoản phí chưa thanh toán
        // Giả sử các khoản phí sẽ được tạo trong KhoanThuCollection
        // và các khoản đã thanh toán sẽ được lưu trong NopTienCollection
        
        // Lấy tất cả khoản thu
        const allFees = await KhoanThuCollection.find().sort({ hanThanhToan: -1 });
        
        // Lấy tất cả khoản đã thanh toán của cư dân
        const paidFees = await NopTienCollection.find({
            tenNguoiNop: req.session.name,
            canHo: "A0101" // Trong thực tế này sẽ là căn hộ của người dùng đăng nhập
        }).populate('khoanThu').sort({ ngayNop: -1 });
        
        // Tính các khoản chưa thanh toán bằng cách lọc ra các khoản thu chưa có trong paidFees
        const unpaidFeesList = allFees.filter(fee => {
            return !paidFees.some(paid => 
                paid.khoanThu && paid.khoanThu._id.toString() === fee._id.toString()
            );
        });
        
        // Format upcomingFees để hiển thị
        const upcomingFees = unpaidFeesList.map(fee => ({
            id: fee._id,
            name: fee.tenKhoanThu,
            amount: fee.soTien,
            dueDate: fee.hanThanhToan
        }));
        
        // Format recentPayments để hiển thị
        const recentPayments = paidFees.map(payment => ({
            id: payment._id,
            name: payment.khoanThu ? payment.khoanThu.tenKhoanThu : 'Không xác định',
            amount: payment.soTien,
            paymentDate: payment.ngayNop,
            status: payment.trangThai
        }));
        
        // Nếu không có dữ liệu thực, dùng dữ liệu mẫu
        if (recentPayments.length === 0) {
            recentPayments.push(
                {
                    id: "recent1",
                    name: "Phí quản lý tháng 04/2023",
                    amount: 500000,
                    paymentDate: new Date('2023-04-15'),
                    status: 'on-time' 
                },
                {
                    id: "recent2",
                    name: "Phí gửi xe tháng 04/2023",
                    amount: 200000,
                    paymentDate: new Date('2023-04-15'),
                    status: 'on-time'
                },
                {
                    id: "recent3",
                    name: "Phí dịch vụ quý 1/2023",
                    amount: 1500000,
                    paymentDate: new Date('2023-03-10'),
                    status: 'on-time'
                }
            );
        }
        
        // Nếu không có khoản phí chưa thanh toán, dùng dữ liệu mẫu
        if (upcomingFees.length === 0) {
            upcomingFees.push(
                {
                    id: "upcoming1",
                    name: "Phí quản lý tháng 05/2023",
                    amount: 500000,
                    dueDate: new Date('2023-05-31')
                },
                {
                    id: "upcoming2",
                    name: "Phí gửi xe tháng 05/2023",
                    amount: 200000,
                    dueDate: new Date('2023-05-31')
                }
            );
        }
        
        // Tính toán thống kê
        const totalFees = allFees.length; 
        const paidFeesCount = paidFees.length;
        const unpaidFeesCount = unpaidFeesList.length;
        
        res.render("cudan-dashboard", {
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId,
                apartment: "A0101"
            },
            residentInfo,
            totalFees,
            paidFees: paidFeesCount,
            unpaidFees: unpaidFeesCount,
            upcomingFees,
            recentPayments
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Error loading dashboard: " + error.message);
    }
});

// Trang khoản thu (thanh toán)
app.get("/cudan/khoan-thu", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        // Get all khoản thu for dropdown, sorted by newest first
        const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
        
        // Get user's previous payments to identify which fees have already been paid
        const userPayments = await NopTienCollection.find({ 
            tenNguoiNop: req.session.name,
            canHo: "A0101" // This would be dynamic based on the user's apartment
        });
        
        // Filter out fees that have already been paid
        const unpaidKhoanThuList = khoanThuList.filter(khoanThu => {
            return !userPayments.some(payment => 
                payment.khoanThu && payment.khoanThu.toString() === khoanThu._id.toString()
            );
        });
        
        res.render("cudan-khoan-thu", { 
            khoanThuList: unpaidKhoanThuList,
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId
            }
        });
    } catch (error) {
        console.error("Error loading thu phí form:", error);
        res.status(500).send("Error loading thu phí form");
    }
});
// Sửa lại route xử lý thanh toán trong file index.js

// Xử lý thanh toán khoản thu
app.post("/cudan/khoan-thu/thanh-toan", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        const { tenKhoanThu, ngayNop, paymentMethod } = req.body;
        
        // Validate inputs
        if (!tenKhoanThu || !ngayNop) {
            // Get khoản thu list for re-rendering the form
            const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
            
            return res.render("cudan-khoan-thu", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                khoanThuList,
                user: {
                    name: req.session.name,
                    role: req.session.role,
                    id: req.session.userId
                }
            });
        }
        
        // Get the khoản thu details
        const khoanThu = await KhoanThuCollection.findById(tenKhoanThu);
        if (!khoanThu) {
            const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
            return res.render("cudan-khoan-thu", { 
                error: "Không tìm thấy khoản thu",
                khoanThuList,
                user: {
                    name: req.session.name,
                    role: req.session.role,
                    id: req.session.userId
                }
            });
        }
        
        // Check if this user already paid for this khoản thu
        const existingPayment = await NopTienCollection.findOne({ 
            khoanThu: tenKhoanThu,
            tenNguoiNop: req.session.name,
            canHo: "A0101" // This would be dynamic based on the user's apartment
        });
        
        if (existingPayment) {
            const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
            return res.render("cudan-khoan-thu", { 
                error: "Bạn đã thanh toán khoản phí này!",
                khoanThuList,
                user: {
                    name: req.session.name,
                    role: req.session.role,
                    id: req.session.userId
                }
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
            tenNguoiNop: req.session.name,
            ngayNop: paymentDate,
            soTien: khoanThu.soTien,
            phuongThucThanhToan: paymentMethod || "cash",
            nguoiThu: "self-service", // Marked as self-service since the user is paying themselves
            canHo: "A0101", // This would be dynamic based on the user's apartment
            trangThai: paymentStatus
        });
        
        await newPayment.save();
        
        // Đổi điều hướng từ /cudan/lich-su thành /cudan/thong-tin
        // Cập nhật thông báo thành công
        req.session.paymentSuccess = `Thanh toán khoản phí ${khoanThu.tenKhoanThu} thành công!`;
        res.redirect("/cudan/thong-tin");
    } catch (error) {
        console.error("Error processing payment:", error);
        const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
        res.render("cudan-khoan-thu", { 
            error: "Lỗi khi xử lý thanh toán: " + error.message,
            khoanThuList,
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId
            }
        });
    }
});
app.post("/cudan/capnhat-thongtin", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        const { name, dateOfBirth, phone, email, idNumber, password } = req.body;
        
        // Tìm hoặc tạo hồ sơ cư dân
        let residentProfile = await ResidentProfileCollection.findOne({ userId: req.session.userId });
        
        if (!residentProfile) {
            // Nếu chưa có hồ sơ, tạo mới
            residentProfile = new ResidentProfileCollection({
                userId: req.session.userId,
                name: req.session.name,
                apartment: "A0101", // Giả định căn hộ
                dateOfBirth: "01/01/1990",
                phone: "0909123456",
                email: "cudan@example.com",
                idNumber: "001234567890",
                moveInDate: "01/01/2023"
            });
        }
        
        // Cập nhật thông tin
        residentProfile.name = name;
        residentProfile.dateOfBirth = dateOfBirth;
        residentProfile.phone = phone;
        residentProfile.email = email;
        residentProfile.idNumber = idNumber;
        residentProfile.updatedAt = new Date();
        
        // Lưu cập nhật
        await residentProfile.save();
        
        // Cập nhật tên trong session
        req.session.name = name;
        
        // Nếu người dùng thay đổi mật khẩu
        if (password && password.trim() !== '') {
            // Trong thực tế, bạn sẽ mã hóa mật khẩu trước khi lưu
            // Ví dụ: sử dụng bcrypt để hash password
            console.log("Password changed, would encrypt and save in real app");

        }
        
        // Đặt thông điệp thành công
        req.session.profileUpdateSuccess = "Cập nhật thông tin cá nhân thành công!";
        
        // Redirect về trang thông tin cá nhân
        res.redirect("/cudan/thong-tin");
    } catch (error) {
        console.error("Error updating resident information:", error);
        req.session.profileUpdateError = "Lỗi khi cập nhật thông tin: " + error.message;
        res.redirect("/cudan/thong-tin");
    }
});

app.get("/cudan/thong-tin", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        // Tìm thông tin cá nhân từ cơ sở dữ liệu
        let residentInfo = await ResidentProfileCollection.findOne({ userId: req.session.userId });
        
        // Nếu không có thông tin, tạo dữ liệu mặc định
        if (!residentInfo) {
            residentInfo = {
                name: req.session.name,
                apartment: "A0101",
                dateOfBirth: "01/01/1990",
                phone: "0909123456",
                email: "cudan@example.com",
                idNumber: "001234567890",
                moveInDate: "01/01/2023"
            };
            
            // Lưu thông tin mặc định vào cơ sở dữ liệu để lần sau có thể cập nhật
            const newProfile = new ResidentProfileCollection({
                userId: req.session.userId,
                ...residentInfo
            });
            
            await newProfile.save();
        }
        
        // Lịch sử thanh toán
        const payments = await NopTienCollection.find({ 
            tenNguoiNop: req.session.name,
            canHo: "A0101" // This would be dynamic based on the user's apartment
        }).populate('khoanThu').sort({ ngayNop: -1 });
        
        // Check for success message from payment
        const success = req.session.paymentSuccess;
        req.session.paymentSuccess = null; // Clear the message after use
        
        // Check for success message from profile update
        const profileUpdateSuccess = req.session.profileUpdateSuccess;
        req.session.profileUpdateSuccess = null; // Clear the message after use
        
        // Check for error message from profile update
        const profileUpdateError = req.session.profileUpdateError;
        req.session.profileUpdateError = null; // Clear the message after use
        
        res.render("cudan-thong-tin", { 
            residentInfo,
            payments,
            success,
            profileUpdateSuccess,
            profileUpdateError,
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId
            }
        });
    } catch (error) {
        console.error("Error loading resident information:", error);
        res.status(500).send("Error loading resident information: " + error.message);
    }
});
app.get("/cudan/feedback", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        // Get resident information
        const residentName = req.session.name;
        
        // For demo, we'll use a placeholder apartment
        // In a real app, you'd get this from your database based on the resident
        const apartment = "A0101"; // Replace with logic to get actual apartment
        
        // Get feedback list for this resident
        const feedbackList = await FeedbackCollection.find({ 
            resident: residentName
        }).sort({ createdAt: -1 });
        
        res.render("cudan-feedback", { 
            feedbackList,
            residentName,
            apartment,
            userName: residentName  // Fix for the error mentioned earlier
        });
    } catch (error) {
        console.error("Error loading feedback form:", error);
        res.status(500).send("Error loading feedback form: " + error.message);
    }
});

// Submit feedback from resident
app.post("/cudan/feedback/submit", ensureAuthenticated, ensureCuDan, async (req, res) => {
    try {
        const { title, category, description } = req.body;
        
        // Validate required fields
        if (!title || !category || !description) {
            // Get feedback list for re-rendering the form
            const residentName = req.session.name;
            const apartment = "A0101"; // Placeholder - replace with actual logic
            const feedbackList = await FeedbackCollection.find({ 
                resident: residentName
            }).sort({ createdAt: -1 });
            
            return res.render("cudan-feedback", { 
                error: "Vui lòng điền đầy đủ thông tin bắt buộc",
                feedbackList,
                residentName,
                apartment,
                userName: residentName
            });
        }
        
        // Get resident information
        const residentName = req.session.name;
        const apartment = "A0101"; // Placeholder - replace with actual logic
        
        // Create new feedback
        const newFeedback = new FeedbackCollection({
            resident: residentName,
            apartment,
            title,
            description,
            category,
            status: 'pending'
        });
        
        await newFeedback.save();
        
        // Get updated feedback list
        const feedbackList = await FeedbackCollection.find({ 
            resident: residentName
        }).sort({ createdAt: -1 });
        
        // Render with success message
        res.render("cudan-feedback", { 
            success: "Phản ánh của bạn đã được gửi thành công và sẽ được xử lý trong thời gian sớm nhất.",
            feedbackList,
            residentName,
            apartment,
            userName: residentName
        });
    } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).send("Error submitting feedback: " + error.message);
    }
});
app.get("/toquan/bao-cao", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // Items per page
        const skip = (page - 1) * limit;
        
        // Count by status for statistics
        const pendingCount = await FeedbackCollection.countDocuments({ status: 'pending' });
        const inProgressCount = await FeedbackCollection.countDocuments({ status: 'in-progress' });
        const resolvedCount = await FeedbackCollection.countDocuments({ status: 'resolved' });
        const rejectedCount = await FeedbackCollection.countDocuments({ status: 'rejected' });
        
        // Get total count for pagination
        const totalCount = await FeedbackCollection.countDocuments();
        const totalPages = Math.ceil(totalCount / limit);
        
        // Get feedback list with pagination
        const feedbackList = await FeedbackCollection.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get session messages
        const feedbackSuccess = req.session.feedbackSuccess;
        const feedbackError = req.session.feedbackError;
        
        // Clear session messages after getting them
        delete req.session.feedbackSuccess;
        delete req.session.feedbackError;
        
        res.render("toquan-bao-cao", {
            feedbackList,
            pendingCount,
            inProgressCount,
            resolvedCount,
            rejectedCount,
            currentPage: page,
            totalPages,
            feedbackSuccess,
            feedbackError
        });
    } catch (error) {
        console.error("Error loading feedback management:", error);
        res.status(500).send("Error loading feedback management: " + error.message);
    }
});

// Cập nhật route POST /toquan/bao-cao/respond
app.post("/toquan/bao-cao/respond", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { feedbackId, status, responseText } = req.body;
        
        console.log("Received feedback response:", { feedbackId, status, responseText });
        
        // Validate required fields
        if (!feedbackId || !status) {
            console.log("Missing required fields");
            req.session.feedbackError = "Thiếu thông tin bắt buộc";
            return res.redirect("/toquan/bao-cao");
        }
        
        // Update feedback
        const feedback = await FeedbackCollection.findById(feedbackId);
        
        if (!feedback) {
            console.log("Feedback not found:", feedbackId);
            req.session.feedbackError = "Phản ánh không tồn tại";
            return res.redirect("/toquan/bao-cao");
        }
        
        feedback.status = status;
        
        // Add response if provided
        if (responseText && responseText.trim() !== '') {
            feedback.response = {
                text: responseText,
                respondedBy: req.session.name,
                respondedAt: new Date()
            };
        }
        
        feedback.updatedAt = new Date();
        
        await feedback.save();
        
        console.log("Feedback updated successfully:", feedback._id);
        
        // Set success message
        req.session.feedbackSuccess = "Phản hồi đã được gửi thành công! Cư dân sẽ nhận được thông báo về cập nhật này.";
        res.redirect("/toquan/bao-cao");
    } catch (error) {
        console.error("Error responding to feedback:", error);
        req.session.feedbackError = "Lỗi khi gửi phản hồi: " + error.message;
        res.redirect("/toquan/bao-cao");
    }
});

// Route AJAX để cập nhật trạng thái nhanh
app.post("/toquan/bao-cao/:id/update-status", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { status } = req.body;
        const feedbackId = req.params.id;
        
        if (!status) {
            return res.status(400).json({ error: "Trạng thái không được để trống" });
        }
        
        const feedback = await FeedbackCollection.findById(feedbackId);
        
        if (!feedback) {
            return res.status(404).json({ error: "Phản ánh không tồn tại" });
        }
        
        const oldStatus = feedback.status;
        feedback.status = status;
        feedback.updatedAt = new Date();
        
        // Add a simple response message when status is updated
        let statusMessage = "";
        switch(status) {
            case 'in-progress':
                statusMessage = "Phản ánh của bạn đang được xử lý.";
                break;
            case 'resolved':
                statusMessage = "Phản ánh của bạn đã được giải quyết.";
                break;
            case 'rejected':
                statusMessage = "Phản ánh của bạn đã bị từ chối.";
                break;
            default:
                statusMessage = "Trạng thái phản ánh đã được cập nhật.";
        }
        
        if (!feedback.response || !feedback.response.text) {
            feedback.response = {
                text: statusMessage,
                respondedBy: req.session.name,
                respondedAt: new Date()
            };
        }
        
        await feedback.save();
        
        console.log(`Status updated from ${oldStatus} to ${status} for feedback ${feedbackId}`);
        
        res.json({ 
            success: true, 
            message: "Cập nhật trạng thái thành công",
            oldStatus,
            newStatus: status
        });
    } catch (error) {
        console.error("Error updating feedback status:", error);
        res.status(500).json({ error: "Lỗi khi cập nhật trạng thái: " + error.message });
    }
});

// Route in biên lai - THÊM MỚI
app.get("/print-receipt/:id", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        // Tìm thông tin thanh toán
        const payment = await NopTienCollection.findById(paymentId).populate('khoanThu');
        
        if (!payment) {
            return res.status(404).send("Không tìm thấy thông tin thanh toán");
        }

        // Tạo HTML template cho biên lai
        const receiptHTML = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Biên lai thu tiền</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Times New Roman', Times, serif;
                    line-height: 1.6;
                    color: #333;
                    background: white;
                    padding: 20px;
                }
                
                .receipt-container {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 2px solid #333;
                    padding: 30px;
                    position: relative;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #4e73df;
                    margin-bottom: 5px;
                }
                
                .company-address {
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                
                .receipt-title {
                    font-size: 28px;
                    font-weight: bold;
                    margin-top: 15px;
                    color: #333;
                }
                
                .receipt-number {
                    font-size: 16px;
                    margin-top: 10px;
                    font-style: italic;
                }
                
                .content {
                    margin: 30px 0;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 15px;
                    font-size: 16px;
                }
                
                .info-label {
                    font-weight: bold;
                    min-width: 200px;
                }
                
                .info-value {
                    flex: 1;
                    border-bottom: 1px dotted #333;
                    padding-bottom: 2px;
                    margin-left: 10px;
                }
                
                .amount-section {
                    background-color: #f8f9fc;
                    border: 2px solid #4e73df;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 30px 0;
                    text-align: center;
                }
                
                .amount-number {
                    font-size: 32px;
                    font-weight: bold;
                    color: #4e73df;
                    margin-bottom: 10px;
                }
                
                .amount-words {
                    font-size: 18px;
                    font-style: italic;
                    color: #333;
                }
                
                .signature-section {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 50px;
                    text-align: center;
                }
                
                .signature-box {
                    flex: 1;
                    margin: 0 20px;
                }
                
                .signature-title {
                    font-weight: bold;
                    margin-bottom: 80px;
                    font-size: 16px;
                }
                
                .signature-name {
                    border-top: 1px solid #333;
                    padding-top: 10px;
                    font-style: italic;
                }
                
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                    border-top: 1px solid #ddd;
                    padding-top: 15px;
                }
                
                .watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 60px;
                    color: rgba(78, 115, 223, 0.1);
                    font-weight: bold;
                    z-index: -1;
                    pointer-events: none;
                }
                
                @media print {
                    body { margin: 0; padding: 0; }
                    .receipt-container { border: none; margin: 0; padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="watermark">BLUEMOON</div>
                
                <div class="header">
                    <div class="company-name">CHUNG CƯ BLUE MOON</div>
                    <div class="company-address">
                        Địa chỉ: 123 Đường ABC, Quận XYZ, Thành phố Hà Nội<br>
                        Điện thoại: (024) 1234-5678 | Email: info@bluemoon.vn
                    </div>
                    <div class="receipt-title">BIÊN LAI THU TIỀN</div>
                    <div class="receipt-number">Số: ${payment._id.toString().slice(-8).toUpperCase()}</div>
                </div>
                
                <div class="content">
                    <div class="info-row">
                        <span class="info-label">Họ và tên người nộp:</span>
                        <span class="info-value">${payment.tenNguoiNop}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Căn hộ:</span>
                        <span class="info-value">${payment.canHo || 'N/A'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Nội dung thu:</span>
                        <span class="info-value">${payment.khoanThu ? payment.khoanThu.tenKhoanThu : 'N/A'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Ngày nộp:</span>
                        <span class="info-value">${new Date(payment.ngayNop).toLocaleDateString('vi-VN')}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Phương thức thanh toán:</span>
                        <span class="info-value">${getPaymentMethodText(payment.phuongThucThanhToan)}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Người thu:</span>
                        <span class="info-value">${payment.nguoiThu}</span>
                    </div>
                </div>
                
                <div class="amount-section">
                    <div class="amount-number">${payment.soTien.toLocaleString('vi-VN')} VNĐ</div>
                    <div class="amount-words">Bằng chữ: ${numberToWords(payment.soTien)} đồng</div>
                </div>
                
                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-title">NGƯỜI NỘP TIỀN</div>
                        <div class="signature-name">${payment.tenNguoiNop}</div>
                    </div>
                    
                    <div class="signature-box">
                        <div class="signature-title">NGƯỜI THU TIỀN</div>
                        <div class="signature-name">${payment.nguoiThu}</div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Biên lai này được tạo tự động bởi hệ thống quản lý chung cư Blue Moon</p>
                    <p>Ngày in: ${new Date().toLocaleString('vi-VN')}</p>
                </div>
            </div>
        </body>
        </html>
        `;

        // Tạo PDF bằng puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(receiptHTML, { waitUntil: 'networkidle0' });
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                bottom: '20px',
                left: '20px',
                right: '20px'
            }
        });
        
        await browser.close();
        
        // Trả về PDF để xem trước (không tải xuống)
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="bien-lai-' + payment._id + '.pdf"'
        });
        
        res.send(pdf);
        
    } catch (error) {
        console.error("Error generating receipt:", error);
        res.status(500).send("Lỗi khi tạo biên lai: " + error.message);
    }
});

// Add middleware function for resident role
function ensureCuDan(req, res, next) {
    if (req.session.role === 'cudan') {
        return next();
    }
    res.status(403).send("Access Denied: Resident privileges required");
}
// Helper function to get status text in Vietnamese
function getStatusText(status) {
    switch(status) {
        case 'pending':
            return 'Chờ xử lý';
        case 'in-progress':
            return 'Đang xử lý';
        case 'completed':
            return 'Hoàn thành';
        case 'cancelled':
            return 'Đã hủy';
        default:
            return status;
    }
}

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

function ensureToQuan(req, res, next) {
    if (req.session.role === 'toquan') {
        return next();
    }
    res.status(403).send("Access Denied: Team Leader privileges required");
}
function ensureToPho(req, res, next) {
    if (req.session.role === 'topho') {
        return next();
    }
    res.status(403).send("Access Denied: Team Leader privileges required");
}
function getPaymentMethodText(method) {
    switch(method) {
        case 'cash': return 'Tiền mặt';
        case 'bank': return 'Chuyển khoản';
        case 'qr': return 'Quét mã QR';
        default: return 'Tiền mặt';
    }
}

function numberToWords(num) {
    if (num === 0) return "không";
    
    const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const tens = ["", "", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
    const hundreds = ["", "một trăm", "hai trăm", "ba trăm", "bốn trăm", "năm trăm", "sáu trăm", "bảy trăm", "tám trăm", "chín trăm"];
    
    function convertGroupOfThree(n) {
        let result = "";
        
        const hundred = Math.floor(n / 100);
        const ten = Math.floor((n % 100) / 10);
        const one = n % 10;
        
        if (hundred > 0) {
            result += hundreds[hundred];
        }
        
        if (ten > 1) {
            result += (result ? " " : "") + tens[ten];
            if (one > 0) {
                result += " " + ones[one];
            }
        } else if (ten === 1) {
            result += (result ? " " : "") + "mười";
            if (one > 0) {
                result += " " + ones[one];
            }
        } else if (one > 0) {
            result += (result ? " " : "") + "lẻ " + ones[one];
        }
        
        return result;
    }
    
    if (num < 1000) {
        return convertGroupOfThree(num);
    }
    
    const billion = Math.floor(num / 1000000000);
    const million = Math.floor((num % 1000000000) / 1000000);
    const thousand = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;
    
    let result = "";
    
    if (billion > 0) {
        result += convertGroupOfThree(billion) + " tỷ";
    }
    
    if (million > 0) {
        result += (result ? " " : "") + convertGroupOfThree(million) + " triệu";
    }
    
    if (thousand > 0) {
        result += (result ? " " : "") + convertGroupOfThree(thousand) + " nghìn";
    }
    
    if (remainder > 0) {
        result += (result ? " " : "") + convertGroupOfThree(remainder);
    }
    
    return result.trim();
}
// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Apartment Management System running on port ${port}`);
});