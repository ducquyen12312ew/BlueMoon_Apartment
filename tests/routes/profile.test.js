// tests/routes/profile.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');

describe('Profile Management Routes', () => {
  let app;
  let testConnection;
  let ResidentProfileCollection;
  let NopTienCollection;
  let KhoanThuCollection;
  let agent;

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
    
    const ResidentProfileSchema = new mongoose.Schema({
      userId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      apartment: { type: String, required: true },
      dateOfBirth: { type: String },
      phone: { type: String },
      email: { type: String },
      idNumber: { type: String },
      moveInDate: { type: String, default: "01/01/2023" },
      updatedAt: { type: Date, default: Date.now }
    });

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

    ResidentProfileCollection = testConnection.model('residentprofiles', ResidentProfileSchema);
    KhoanThuCollection = testConnection.model('khoanthus', KhoanThuSchema);
    NopTienCollection = testConnection.model('noptiens', NopTienSchema);

    // Authentication middleware
    const ensureAuthenticated = (req, res, next) => {
      if (req.session.userId) {
        return next();
      }
      res.status(401).json({ error: 'Authentication required' });
    };

    const ensureCuDan = (req, res, next) => {
      if (req.session.role === 'cudan') {
        return next();
      }
      res.status(403).json({ error: 'Resident privileges required' });
    };

    // Login route
    app.post('/login', (req, res) => {
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

    // Profile routes
    app.get('/cudan/thong-tin', ensureAuthenticated, ensureCuDan, async (req, res) => {
      try {
        let residentInfo = await ResidentProfileCollection.findOne({ userId: req.session.userId });
        
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
          
          const newProfile = new ResidentProfileCollection({
            userId: req.session.userId,
            ...residentInfo
          });
          
          await newProfile.save();
          residentInfo = newProfile;
        }

        const payments = await NopTienCollection.find({ 
          tenNguoiNop: req.session.name,
          canHo: "A0101"
        }).populate('khoanThu').sort({ ngayNop: -1 });

        res.json({ 
          residentInfo,
          payments,
          user: {
            name: req.session.name,
            role: req.session.role,
            id: req.session.userId
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Error loading resident information: ' + error.message });
      }
    });

    app.post('/cudan/capnhat-thongtin', ensureAuthenticated, ensureCuDan, async (req, res) => {
      try {
        const { name, dateOfBirth, phone, email, idNumber, password, passwordConfirm } = req.body;
        
        // Validate required fields
        if (!name) {
          return res.status(400).json({ error: 'Tên không được để trống' });
        }

        // Validate password confirmation if password is provided
        if (password && password !== passwordConfirm) {
          return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
        }

        // Validate phone number format
        if (phone) {
          const phonePattern = /^(0|\+84)(\d{9,10})$/;
          if (!phonePattern.test(phone)) {
            return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
          }
        }

        // Validate email format
        if (email) {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(email)) {
            return res.status(400).json({ error: 'Địa chỉ email không hợp lệ' });
          }
        }

        // Validate ID number
        if (idNumber) {
          const idNumberPattern = /^\d{9,12}$/;
          if (!idNumberPattern.test(idNumber)) {
            return res.status(400).json({ error: 'Số CCCD/CMND không hợp lệ' });
          }
        }

        let residentProfile = await ResidentProfileCollection.findOne({ userId: req.session.userId });
        
        if (!residentProfile) {
          residentProfile = new ResidentProfileCollection({
            userId: req.session.userId,
            name: req.session.name,
            apartment: "A0101",
            dateOfBirth: "01/01/1990",
            phone: "0909123456",
            email: "cudan@example.com",
            idNumber: "001234567890",
            moveInDate: "01/01/2023"
          });
        }

        // Update profile information
        residentProfile.name = name;
        residentProfile.dateOfBirth = dateOfBirth || residentProfile.dateOfBirth;
        residentProfile.phone = phone || residentProfile.phone;
        residentProfile.email = email || residentProfile.email;
        residentProfile.idNumber = idNumber || residentProfile.idNumber;
        residentProfile.updatedAt = new Date();

        await residentProfile.save();

        // Update session name
        req.session.name = name;

        res.json({ 
          success: true, 
          message: 'Cập nhật thông tin cá nhân thành công!',
          data: residentProfile
        });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật thông tin: ' + error.message });
      }
    });

    app.get('/api/profile/:userId', ensureAuthenticated, async (req, res) => {
      try {
        const profile = await ResidentProfileCollection.findOne({ userId: req.params.userId });
        if (!profile) {
          return res.status(404).json({ error: 'Profile không tồn tại' });
        }
        res.json(profile);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
      }
    });

    app.get('/api/profile/:userId/payments', ensureAuthenticated, async (req, res) => {
      try {
        const profile = await ResidentProfileCollection.findOne({ userId: req.params.userId });
        if (!profile) {
          return res.status(404).json({ error: 'Profile không tồn tại' });
        }

        const payments = await NopTienCollection.find({ 
          tenNguoiNop: profile.name,
          canHo: profile.apartment
        }).populate('khoanThu').sort({ ngayNop: -1 });

        res.json(payments);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching payment history' });
      }
    });

    // Tạo agent để maintain session
    agent = request.agent(app);
  });

  beforeEach(async () => {
    // Clear database và login trước mỗi test
    if (ResidentProfileCollection) {
      await ResidentProfileCollection.deleteMany({});
    }
    if (NopTienCollection) {
      await NopTienCollection.deleteMany({});
    }
    if (KhoanThuCollection) {
      await KhoanThuCollection.deleteMany({});
    }
    
    // Login as cudan
    await agent
      .post('/login')
      .send({ username: 'cudan1', password: '123456789' });
  });

  // TEST 1: Get profile information (create default if not exists)
  test('Should get profile information and create default if not exists', async () => {
    const response = await agent.get('/cudan/thong-tin');

    expect(response.status).toBe(200);
    expect(response.body.residentInfo).toBeDefined();
    expect(response.body.residentInfo.name).toBe('cudan');
    expect(response.body.residentInfo.apartment).toBe('A0101');
    expect(response.body.payments).toBeDefined();
    expect(Array.isArray(response.body.payments)).toBe(true);
  });

  // TEST 2: Successfully update profile information
  test('Should successfully update profile information', async () => {
    const updateData = {
      name: 'Nguyễn Văn Test',
      dateOfBirth: '15/05/1985',
      phone: '0912345678',
      email: 'test@example.com',
      idNumber: '123456789012'
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Cập nhật thông tin cá nhân thành công!');
    expect(response.body.data.name).toBe('Nguyễn Văn Test');
    expect(response.body.data.phone).toBe('0912345678');
    expect(response.body.data.email).toBe('test@example.com');
  });

  // TEST 3: Fail to update without required name field
  test('Should fail to update without required name field', async () => {
    const updateData = {
      phone: '0912345678',
      email: 'test@example.com'
      // Missing name
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Tên không được để trống');
  });

  // TEST 4: Validate phone number format
  test('Should validate phone number format', async () => {
    const updateData = {
      name: 'Test User',
      phone: '123' // Invalid phone format
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Số điện thoại không hợp lệ');
  });

  // TEST 5: Validate email format
  test('Should validate email format', async () => {
    const updateData = {
      name: 'Test User',
      email: 'invalid-email' // Invalid email format
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Địa chỉ email không hợp lệ');
  });

  // TEST 6: Validate ID number format
  test('Should validate ID number format', async () => {
    const updateData = {
      name: 'Test User',
      idNumber: '123' // Invalid ID number (too short)
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Số CCCD/CMND không hợp lệ');
  });

  // TEST 7: Password confirmation validation
  test('Should validate password confirmation', async () => {
    const updateData = {
      name: 'Test User',
      password: 'newpassword123',
      passwordConfirm: 'differentpassword'
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Mật khẩu xác nhận không khớp');
  });

  // TEST 8: Valid phone number formats
  test('Should accept valid phone number formats', async () => {
    const validPhones = ['0912345678', '0987654321', '+84912345678'];

    for (let i = 0; i < validPhones.length; i++) {
      const updateData = {
        name: `Test User ${i}`,
        phone: validPhones[i]
      };

      const response = await agent
        .post('/cudan/capnhat-thongtin')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.phone).toBe(validPhones[i]);
    }
  });

  // TEST 9: Get profile with payment history
  test('Should get profile with payment history', async () => {
    // Create khoan thu and payment
    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({
        maKhoanThu: 'KT001',
        tenKhoanThu: 'Test Fee',
        soTien: 500000
      })
    );

    await NopTienCollection.create({
      khoanThu: khoanThu._id,
      tenNguoiNop: 'cudan',
      ngayNop: new Date(),
      soTien: 500000,
      phuongThucThanhToan: 'cash',
      nguoiThu: 'admin',
      canHo: 'A0101',
      trangThai: 'on-time'
    });

    const response = await agent.get('/cudan/thong-tin');

    expect(response.status).toBe(200);
    expect(response.body.payments).toHaveLength(1);
    expect(response.body.payments[0].tenNguoiNop).toBe('cudan');
    expect(response.body.payments[0].soTien).toBe(500000);
  });

  // TEST 10: Get specific profile by userId
  test('Should get specific profile by userId', async () => {
    // Create a profile first
    const profile = await ResidentProfileCollection.create({
      userId: '10',
      name: 'Test Resident',
      apartment: 'A0101',
      dateOfBirth: '01/01/1990',
      phone: '0909123456',
      email: 'test@example.com',
      idNumber: '123456789012',
      moveInDate: '01/01/2023'
    });

    const response = await agent.get('/api/profile/10');

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('10');
    expect(response.body.name).toBe('Test Resident');
    expect(response.body.apartment).toBe('A0101');
  });

  // TEST 11: Handle non-existent profile
  test('Should handle request for non-existent profile', async () => {
    const response = await agent.get('/api/profile/999');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Profile không tồn tại');
  });

  // TEST 12: Get payment history for specific user
  test('Should get payment history for specific user', async () => {
    // Create profile and payment data
    const profile = await ResidentProfileCollection.create({
      userId: '10',
      name: 'Test Resident',
      apartment: 'A0101'
    });

    const khoanThu = await KhoanThuCollection.create(
      global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' })
    );

    await NopTienCollection.create({
      khoanThu: khoanThu._id,
      tenNguoiNop: 'Test Resident',
      ngayNop: new Date(),
      soTien: 300000,
      phuongThucThanhToan: 'bank',
      nguoiThu: 'admin',
      canHo: 'A0101',
      trangThai: 'on-time'
    });

    const response = await agent.get('/api/profile/10/payments');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].tenNguoiNop).toBe('Test Resident');
  });

  // TEST 13: Update profile multiple times
  test('Should handle multiple profile updates correctly', async () => {
    // First update
    const firstUpdate = {
      name: 'First Name',
      phone: '0911111111'
    };

    const firstResponse = await agent
      .post('/cudan/capnhat-thongtin')
      .send(firstUpdate);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.data.name).toBe('First Name');

    // Second update
    const secondUpdate = {
      name: 'Second Name',
      email: 'second@example.com'
    };

    const secondResponse = await agent
      .post('/cudan/capnhat-thongtin')
      .send(secondUpdate);

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.data.name).toBe('Second Name');
    expect(secondResponse.body.data.email).toBe('second@example.com');
    expect(secondResponse.body.data.phone).toBe('0911111111'); // Should preserve previous value
  });

  // TEST 14: Session name update after profile update
  test('Should update session name after profile update', async () => {
    const updateData = {
      name: 'New Session Name'
    };

    await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    // Verify session name is updated by checking subsequent requests
    const response = await agent.get('/cudan/thong-tin');

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('New Session Name');
  });

  // TEST 15: Authorization requirements
  test('Should require authentication for profile operations', async () => {
    const newAgent = request.agent(app);
    
    const response = await newAgent.get('/cudan/thong-tin');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  // TEST 16: Profile creation with default values
  test('Should create profile with correct default values', async () => {
    const response = await agent.get('/cudan/thong-tin');

    expect(response.status).toBe(200);
    expect(response.body.residentInfo.apartment).toBe('A0101');
    expect(response.body.residentInfo.dateOfBirth).toBe('01/01/1990');
    expect(response.body.residentInfo.moveInDate).toBe('01/01/2023');
    expect(response.body.residentInfo.updatedAt).toBeDefined();
  });

  // TEST 17: Partial profile updates
  test('Should handle partial profile updates', async () => {
    // First create profile with all fields
    await agent.post('/cudan/capnhat-thongtin').send({
      name: 'Full Name',
      phone: '0911111111',
      email: 'full@example.com',
      idNumber: '123456789012'
    });

    // Update only phone
    const partialUpdate = {
      name: 'Full Name', // Name is required
      phone: '0922222222'
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(partialUpdate);

    expect(response.status).toBe(200);
    expect(response.body.data.phone).toBe('0922222222');
    expect(response.body.data.email).toBe('full@example.com'); // Should remain unchanged
  });

  // TEST 18: Profile timestamps
  test('Should properly track profile update timestamps', async () => {
    const beforeUpdate = new Date();
    
    const updateData = {
      name: 'Timestamp Test'
    };

    const response = await agent
      .post('/cudan/capnhat-thongtin')
      .send(updateData);

    const afterUpdate = new Date();

    expect(response.status).toBe(200);
    
    const updatedAt = new Date(response.body.data.updatedAt);
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
  });
});
