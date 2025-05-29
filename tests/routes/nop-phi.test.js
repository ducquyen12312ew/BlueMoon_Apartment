// tests/routes/nop-phi.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');

describe('Payment Processing Routes', () => {
  let app;
  let testConnection;
  let KhoanThuCollection;
  let NopTienCollection;
  let adminAgent;
  let cudanAgent;

  beforeAll(async () => {
    // Tạo Express app cho test
    app = express();
    
    // Middleware setup
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }
    }));

    // Tạo connection và schemas
    testConnection = global.testConfig.testConnection;
    
    const KhoanThuSchema = new mongoose.Schema({
      maKhoanThu: { type: String, required: true, unique: true },
      tenKhoanThu: { type: String, required: true },
      soTien: { type: Number, required: true },
      loaiKhoanThu: { type: Number, enum: [0, 1], default: 0 },
      ngayTao: { type: Date, default: Date.now },
      hanThanhToan: { type: Date },
      moTa: { type: String }
    });

    const NopTienSchema = new mongoose.Schema({
      khoanThu: { type: mongoose.Schema.Types.ObjectId, ref: 'khoanthus', required: true },
      tenNguoiNop: { type: String, required: true },
      ngayNop: { type: Date, default: Date.now, required: true },
      soTien: { type: Number, required: true },
      phuongThucThanhToan: { type: String, enum: ['cash', 'bank', 'qr'], default: 'cash' },
      nguoiThu: { type: String, required: true },
      canHo: { type: String },
      trangThai: { type: String, enum: ['on-time', 'late', 'partial'], default: 'on-time' },
      ghiChu: { type: String }
    });

    KhoanThuCollection = testConnection.model('khoanthus', KhoanThuSchema);
    NopTienCollection = testConnection.model('noptiens', NopTienSchema);

    // Authentication middleware
    const ensureAuthenticated = (req, res, next) => {
      if (req.session.userId) {
        return next();
      }
      res.status(401).json({ error: 'Authentication required' });
    };

    const ensureAdmin = (req, res, next) => {
      if (req.session.role === 'admin') {
        return next();
      }
      res.status(403).json({ error: 'Admin privileges required' });
    };

    const ensureCuDan = (req, res, next) => {
      if (req.session.role === 'cudan') {
        return next();
      }
      res.status(403).json({ error: 'Resident privileges required' });
    };

    // Login routes
    app.post('/admin/login', (req, res) => {
      const { username, password } = req.body;
      if (username === 'ketoan' && password === '123456789') {
        req.session.name = 'admin';
        req.session.role = 'admin';
        req.session.userId = '1';
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    app.post('/cudan/login', (req, res) => {
      const { username, password } = req.body;
      if (username === 'cudan1' && password === '123456789') {
        req.session.name = 'cudan';
        req.session.role = 'cudan';
        req.session.userId = '10';
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    // Admin payment processing route
    app.post('/thu-phi/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
      try {
        const { tenKhoanThu, tenNguoiNop, ngayNop, paymentMethod, canHo } = req.body;
        
        if (!tenKhoanThu || !tenNguoiNop || !ngayNop || !canHo) {
          return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        const khoanThu = await KhoanThuCollection.findById(tenKhoanThu);
        if (!khoanThu) {
          return res.status(404).json({ error: 'Không tìm thấy khoản thu' });
        }

        // Check if already paid
        const existingPayment = await NopTienCollection.findOne({ 
          khoanThu: tenKhoanThu,
          canHo: canHo
        });
        
        if (existingPayment) {
          return res.status(400).json({ error: 'Căn hộ này đã nộp khoản phí này!' });
        }

        // Parse payment date
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
        res.status(201).json({ success: true, data: newPayment });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xử lý thu phí: ' + error.message });
      }
    });

    // Resident payment route
    app.post('/cudan/khoan-thu/thanh-toan', ensureAuthenticated, ensureCuDan, async (req, res) => {
      try {
        const { tenKhoanThu, ngayNop, paymentMethod } = req.body;
        
        if (!tenKhoanThu || !ngayNop) {
          return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        const khoanThu = await KhoanThuCollection.findById(tenKhoanThu);
        if (!khoanThu) {
          return res.status(404).json({ error: 'Không tìm thấy khoản thu' });
        }

        // Check if already paid by this user
        const existingPayment = await NopTienCollection.findOne({ 
          khoanThu: tenKhoanThu,
          tenNguoiNop: req.session.name,
          canHo: "A0101"
        });
        
        if (existingPayment) {
          return res.status(400).json({ error: 'Bạn đã thanh toán khoản phí này!' });
        }

        // Parse payment date
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

        const newPayment = new NopTienCollection({
          khoanThu: tenKhoanThu,
          tenNguoiNop: req.session.name,
          ngayNop: paymentDate,
          soTien: khoanThu.soTien,
          phuongThucThanhToan: paymentMethod || "cash",
          nguoiThu: "self-service",
          canHo: "A0101",
          trangThai: paymentStatus
        });

        await newPayment.save();
        res.status(201).json({ success: true, data: newPayment });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xử lý thanh toán: ' + error.message });
      }
    });

    // Get payments route
    app.get('/api/payments', ensureAuthenticated, async (req, res) => {
      try {
        const payments = await NopTienCollection.find()
          .populate('khoanThu')
          .sort({ ngayNop: -1 });
        res.json(payments);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching payments' });
      }
    });

    // Get payments by user
    app.get('/api/payments/user', ensureAuthenticated, async (req, res) => {
      try {
        const payments = await NopTienCollection.find({ 
          tenNguoiNop: req.session.name,
          canHo: "A0101"
        })
          .populate('khoanThu')
          .sort({ ngayNop: -1 });
        res.json(payments);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching user payments' });
      }
    });

    // Tạo agents để maintain sessions
    adminAgent = request.agent(app);
    cudanAgent = request.agent(app);
  });

  beforeEach(async () => {
    // Clear database và login trước mỗi test
    if (KhoanThuCollection) {
      await KhoanThuCollection.deleteMany({});
    }
    if (NopTienCollection) {
      await NopTienCollection.deleteMany({});
    }
    
    // Login as admin và cư dân
    await adminAgent
      .post('/admin/login')
      .send({ username: 'ketoan', password: '123456789' });

    await cudanAgent
      .post('/cudan/login')
      .send({ username: 'cudan1', password: '123456789' });
  });

  // TEST 1: Admin successfully processes payment
  test('Admin should successfully process payment', async () => {
    // Create khoan thu first
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({
        maKhoanThu: 'KT001',
        soTien: 500000
      })
    );

    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'Nguyễn Văn A',
      ngayNop: '15/01/2024',
      paymentMethod: 'cash',
      canHo: 'A101'
    };

    const response = await adminAgent
      .post('/thu-phi/create')
      .send(paymentData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenNguoiNop).toBe('Nguyễn Văn A');
    expect(response.body.data.soTien).toBe(500000);
    expect(response.body.data.trangThai).toBe('on-time');
  });

  // TEST 2: Resident successfully makes self-payment
  test('Resident should successfully make self-payment', async () => {
    // Create khoan thu first
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({
        maKhoanThu: 'KT001',
        soTien: 300000
      })
    );

    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      ngayNop: '10/01/2024',
      paymentMethod: 'bank'
    };

    const response = await cudanAgent
      .post('/cudan/khoan-thu/thanh-toan')
      .send(paymentData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenNguoiNop).toBe('cudan');
    expect(response.body.data.nguoiThu).toBe('self-service');
    expect(response.body.data.phuongThucThanhToan).toBe('bank');
  });

  // TEST 3: Prevent duplicate payments
  test('Should prevent duplicate payments for same apartment and khoan thu', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'Nguyễn Văn A',
      ngayNop: '15/01/2024',
      paymentMethod: 'cash',
      canHo: 'A101'
    };

    // First payment
    const firstResponse = await adminAgent
      .post('/thu-phi/create')
      .send(paymentData);

    expect(firstResponse.status).toBe(201);

    // Second payment with same apartment
    const secondResponse = await adminAgent
      .post('/thu-phi/create')
      .send(paymentData);

    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.error).toBe('Căn hộ này đã nộp khoản phí này!');
  });

  // TEST 4: Prevent resident duplicate payments
  test('Should prevent resident from paying twice for same khoan thu', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      ngayNop: '10/01/2024',
      paymentMethod: 'cash'
    };

    // First payment
    const firstResponse = await cudanAgent
      .post('/cudan/khoan-thu/thanh-toan')
      .send(paymentData);

    expect(firstResponse.status).toBe(201);

    // Second payment attempt
    const secondResponse = await cudanAgent
      .post('/cudan/khoan-thu/thanh-toan')
      .send(paymentData);

    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.error).toBe('Bạn đã thanh toán khoản phí này!');
  });

  // TEST 5: Detect late payments
  test('Should correctly detect late payments', async () => {
    // Create khoan thu with due date in the past
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10); // 10 days ago

    const khoanThu = await KhoanThuCollection.create({
      ...global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' }),
      hanThanhToan: pastDate
    });

    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'Nguyễn Văn B',
      ngayNop: new Date().toLocaleDateString('vi-VN'), // Today
      paymentMethod: 'cash',
      canHo: 'A102'
    };

    const response = await adminAgent
      .post('/thu-phi/create')
      .send(paymentData);

    expect(response.status).toBe(201);
    expect(response.body.data.trangThai).toBe('late');
  });

  // TEST 6: Validate payment methods
  test('Should accept different payment methods', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    const paymentMethods = ['cash', 'bank', 'qr'];

    for (let i = 0; i < paymentMethods.length; i++) {
      const paymentData = {
        tenKhoanThu: khoanThu._id.toString(),
        tenNguoiNop: `User ${i}`,
        ngayNop: '15/01/2024',
        paymentMethod: paymentMethods[i],
        canHo: `A10${i + 1}`
      };

      const response = await adminAgent
        .post('/thu-phi/create')
        .send(paymentData);

      expect(response.status).toBe(201);
      expect(response.body.data.phuongThucThanhToan).toBe(paymentMethods[i]);
    }
  });

  // TEST 7: Handle missing required fields
  test('Should reject payment with missing required fields', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    const incompleteData = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'Nguyễn Văn A'
      // Missing ngayNop and canHo
    };

    const response = await adminAgent
      .post('/thu-phi/create')
      .send(incompleteData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Vui lòng điền đầy đủ thông tin bắt buộc');
  });

  // TEST 8: Handle non-existent khoan thu
  test('Should handle payment for non-existent khoan thu', async () => {
    const fakeKhoanThuId = new mongoose.Types.ObjectId();

    const paymentData = {
      tenKhoanThu: fakeKhoanThuId.toString(),
      tenNguoiNop: 'Nguyễn Văn A',
      ngayNop: '15/01/2024',
      paymentMethod: 'cash',
      canHo: 'A101'
    };

    const response = await adminAgent
      .post('/thu-phi/create')
      .send(paymentData);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Không tìm thấy khoản thu');
  });

  // TEST 9: Get all payments
  test('Should retrieve all payments', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    // Create some payments
    const payment1 = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'User 1',
      ngayNop: '15/01/2024',
      paymentMethod: 'cash',
      canHo: 'A101'
    };

    const payment2 = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'User 2',
      ngayNop: '16/01/2024',
      paymentMethod: 'bank',
      canHo: 'A102'
    };

    await adminAgent.post('/thu-phi/create').send(payment1);
    await adminAgent.post('/thu-phi/create').send(payment2);

    const response = await adminAgent.get('/api/payments');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
  });

  // TEST 10: Get user-specific payments
  test('Should retrieve user-specific payments', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    // Resident makes payment
    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      ngayNop: '10/01/2024',
      paymentMethod: 'bank'
    };

    await cudanAgent
      .post('/cudan/khoan-thu/thanh-toan')
      .send(paymentData);

    const response = await cudanAgent.get('/api/payments/user');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].tenNguoiNop).toBe('cudan');
  });

  // TEST 11: Authorization tests
  test('Should require authentication for payment operations', async () => {
    const newAgent = request.agent(app);
    
    const response = await newAgent
      .post('/thu-phi/create')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  // TEST 12: Date parsing functionality
  test('Should parse payment dates correctly', async () => {
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    const paymentData = {
      tenKhoanThu: khoanThu._id.toString(),
      tenNguoiNop: 'Date Test User',
      ngayNop: '25/12/2023',
      paymentMethod: 'cash',
      canHo: 'A101'
    };

    const response = await adminAgent
      .post('/thu-phi/create')
      .send(paymentData);

    expect(response.status).toBe(201);
    
    const paymentDate = new Date(response.body.data.ngayNop);
    expect(paymentDate.getDate()).toBe(25);
    expect(paymentDate.getMonth()).toBe(11); // December is 11
    expect(paymentDate.getFullYear()).toBe(2023);
  });
});