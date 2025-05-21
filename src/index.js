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
    HoKhauCollection,
    NhanKhauCollection,
    TamTruCollection,
    TamVangCollection,
    BienDoiNhanKhauCollection,
    NopTienCollection,
    MaintenanceStaffCollection
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

        if(username === "admin" && password === "123456789") {
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
        
        // Lấy danh sách nhân khẩu trong hộ
        const nhankhauList = await NhanKhauCollection.find({ hoKhau: hokhau._id });
        
        res.render("hokhau-detail", { hokhau, nhankhauList });
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

// Thêm route cho trang hộ khẩu-nhân khẩu
// Thêm các routes sau vào file src/index.js

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
        
        res.render("hokhau-nhankhau", {
            totalHoKhau: hokhauList.length,
            totalNhanKhau: await NhanKhauCollection.countDocuments(),
            hokhauList: hokhauWithMembers
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


app.get("/toquan/maintenance", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        // Get all apartments for the dropdown in the form
        const apartments = await ApartmentCollection.find().sort({ number: 1 });
        
        // Get all maintenance staff for assignment (for this demo, we'll use admin users as staff)
        const maintenance_staff = await UserCollection.find({ role: 'admin' }).sort({ name: 1 });
        
        // Get all maintenance requests with populated references
        const maintenanceRequests = await MaintenanceRequestCollection.find()
            .populate('apartment')
            .populate('requestedBy')
            .populate('assignedTo')
            .sort({ createdAt: -1 });
        
        res.render("maintenance-schedule", { 
            apartments, 
            maintenance_staff, 
            maintenanceRequests 
        });
    } catch (error) {
        console.error("Error loading maintenance page:", error);
        res.status(500).send("Error loading maintenance page");
    }
});

// Create new maintenance request
app.post("/toquan/maintenance/create", ensureAuthenticated, ensureToQuan, async (req, res) => {
    try {
        const { apartment, priority, title, description, scheduledDate, assignedTo } = req.body;
        
        // Validate required fields
        if (!apartment || !priority || !title || !description) {
            return res.status(400).send("Missing required fields");
        }
        
        // Parse scheduled date if provided
        let parsedScheduledDate = null;
        if (scheduledDate && scheduledDate.trim() !== '') {
            if (scheduledDate.includes('/')) {
                const [day, month, year] = scheduledDate.split('/');
                parsedScheduledDate = new Date(year, month - 1, day);
            } else {
                parsedScheduledDate = new Date(scheduledDate);
            }
        }
        
        // Create new maintenance request
        const newRequest = new MaintenanceRequestCollection({
            apartment,
            requestedBy: req.session.userId,
            title,
            description,
            priority,
            status: 'pending',
            assignedTo: assignedTo || null,
            scheduledDate: parsedScheduledDate,
            notes: [{
                text: `Yêu cầu bảo trì được tạo bởi ${req.session.name}`,
                addedBy: req.session.userId,
                addedAt: new Date()
            }]
        });
        
        await newRequest.save();
        res.redirect("/maintenance");
    } catch (error) {
        console.error("Error creating maintenance request:", error);
        res.status(500).send("Error creating maintenance request");
    }
});

// Assign staff to maintenance request
app.post("/toquan/maintenance/assign", ensureAuthenticated,ensureToQuan, async (req, res) => {
    try {
        const { requestId, staffMember, scheduledTime, notes } = req.body;
        
        // Validate required fields
        if (!requestId || !staffMember || !scheduledTime) {
            return res.status(400).send("Missing required fields");
        }
        
        // Parse scheduled time
        let parsedScheduledTime = null;
        if (scheduledTime.includes('/')) {
            const [day, month, year] = scheduledTime.split('/');
            parsedScheduledTime = new Date(year, month - 1, day);
        } else {
            parsedScheduledTime = new Date(scheduledTime);
        }
        
        // Update the maintenance request
        const maintenanceRequest = await MaintenanceRequestCollection.findById(requestId);
        if (!maintenanceRequest) {
            return res.status(404).send("Maintenance request not found");
        }
        
        maintenanceRequest.assignedTo = staffMember;
        maintenanceRequest.status = 'in-progress';
        maintenanceRequest.scheduledDate = parsedScheduledTime;
        
        // Add a note about the assignment
        maintenanceRequest.notes.push({
            text: notes ? `Phân công cho nhân viên. ${notes}` : 'Phân công cho nhân viên.',
            addedBy: req.session.userId,
            addedAt: new Date()
        });
        
        await maintenanceRequest.save();
        res.redirect("/maintenance");
    } catch (error) {
        console.error("Error assigning staff:", error);
        res.status(500).send("Error assigning staff");
    }
});

// Update maintenance request status
app.post("/maintenance/update-status", ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { requestId, status, notes } = req.body;
        
        // Validate required fields
        if (!requestId || !status) {
            return res.status(400).send("Missing required fields");
        }
        
        // Update the maintenance request
        const maintenanceRequest = await MaintenanceRequestCollection.findById(requestId);
        if (!maintenanceRequest) {
            return res.status(404).send("Maintenance request not found");
        }
        
        maintenanceRequest.status = status;
        
        // If status is completed, set completedAt
        if (status === 'completed') {
            maintenanceRequest.completedAt = new Date();
        }
        
        // Add a note about the status update
        if (notes) {
            maintenanceRequest.notes.push({
                text: `Cập nhật trạng thái thành ${getStatusText(status)}. ${notes}`,
                addedBy: req.session.userId,
                addedAt: new Date()
            });
        } else {
            maintenanceRequest.notes.push({
                text: `Cập nhật trạng thái thành ${getStatusText(status)}.`,
                addedBy: req.session.userId,
                addedAt: new Date()
            });
        }
        
        await maintenanceRequest.save();
        res.redirect("/maintenance");
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).send("Error updating status");
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
// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Apartment Management System running on port ${port}`);
});