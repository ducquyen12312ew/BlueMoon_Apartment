// tests/routes/khoan-thu.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');

describe('Khoan Thu Management Routes', () => {
  let app;
  let testConnection;
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

    // Tạo connection và schema
    testConnection = global.testConfig.testConnection;
    
    const KhoanThuSchema = new mongoose.Schema({
      maKhoanThu: { type: String, required: true, unique: true },
      tenKhoanThu: { type: String, required: true },
      soTien: { type: Number, required: true },
      loaiKhoanThu: { type: Number, enum: [0, 1], default: 0 },
      ngayTao: { type: Date, default: Date.now },
      hanThanhToan: { type: Date },
      moTa: { type: String },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' }
    });

    KhoanThuCollection = testConnection.model('khoanthus', KhoanThuSchema);

    // Middleware để kiểm tra authentication
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

    // Test login route
    app.post('/login', (req, res) => {
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

    // Khoan Thu routes
    app.get('/api/khoan-thu', ensureAuthenticated, ensureAdmin, async (req, res) => {
      try {
        const khoanThuList = await KhoanThuCollection.find().sort({ ngayTao: -1 });
        res.json(khoanThuList);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching khoan thu list' });
      }
    });

    app.get('/api/khoan-thu/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
      try {
        const khoanThu = await KhoanThuCollection.findById(req.params.id);
        if (!khoanThu) {
          return res.status(404).json({ error: 'Khoản thu không tồn tại' });
        }
        res.json(khoanThu);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching khoan thu details' });
      }
    });

    app.post('/khoan-thu/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
      try {
        const { maKhoanThu, tenKhoanThu, soTien, loaiKhoanThu, ngayTao, hanThanhToan, moTa } = req.body;
        
        // Validate required fields
        if (!maKhoanThu || !tenKhoanThu || !soTien) {
          return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        // Check for duplicate maKhoanThu
        const existingKhoanThu = await KhoanThuCollection.findOne({ maKhoanThu });
        if (existingKhoanThu) {
          return res.status(400).json({ error: 'Mã khoản thu đã tồn tại' });
        }

        // Parse dates
        let parsedNgayTao = new Date();
        if (ngayTao) {
          if (ngayTao.includes('/')) {
            const [day, month, year] = ngayTao.split('/');
            parsedNgayTao = new Date(year, month - 1, day);
          } else {
            parsedNgayTao = new Date(ngayTao);
          }
        }

        let parsedHanThanhToan = null;
        if (hanThanhToan) {
          if (hanThanhToan.includes('/')) {
            const [day, month, year] = hanThanhToan.split('/');
            parsedHanThanhToan = new Date(year, month - 1, day);
          } else {
            parsedHanThanhToan = new Date(hanThanhToan);
          }
        }

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
        res.status(201).json({ success: true, data: newKhoanThu });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi tạo khoản thu: ' + error.message });
      }
    });

    app.post('/khoan-thu/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
      try {
        const { maKhoanThu, tenKhoanThu, soTien, loaiKhoanThu, moTa } = req.body;
        
        if (!maKhoanThu || !tenKhoanThu || !soTien) {
          return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        // Check duplicate excluding current record
        const existingKhoanThu = await KhoanThuCollection.findOne({ 
          maKhoanThu, 
          _id: { $ne: req.params.id } 
        });
        
        if (existingKhoanThu) {
          return res.status(400).json({ error: 'Mã khoản thu đã tồn tại' });
        }

        const updatedKhoanThu = await KhoanThuCollection.findByIdAndUpdate(
          req.params.id,
          {
            maKhoanThu,
            tenKhoanThu,
            soTien: parseFloat(soTien),
            loaiKhoanThu: parseInt(loaiKhoanThu || 0),
            moTa: moTa || ""
          },
          { new: true }
        );

        if (!updatedKhoanThu) {
          return res.status(404).json({ error: 'Khoản thu không tồn tại' });
        }

        res.json({ success: true, data: updatedKhoanThu });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật khoản thu: ' + error.message });
      }
    });

    app.delete('/khoan-thu/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
      try {
        const khoanThu = await KhoanThuCollection.findById(req.params.id);
        
        if (!khoanThu) {
          return res.status(404).json({ error: 'Khoản thu không tồn tại' });
        }

        await KhoanThuCollection.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Xóa khoản thu thành công' });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xóa khoản thu: ' + error.message });
      }
    });

    // Tạo agent để maintain session
    agent = request.agent(app);
  });

  beforeEach(async () => {
    // Clear database và login trước mỗi test
    if (KhoanThuCollection) {
      await KhoanThuCollection.deleteMany({});
    }
    
    // Login as admin
    await agent
      .post('/login')
      .send({ username: 'ketoan', password: '123456789' });
  });

  // TEST 1: Create khoan thu successfully
  test('POST /khoan-thu/create should create new khoan thu successfully', async () => {
    const khoanThuData = global.testHelpers.createMockKhoanThu({
      maKhoanThu: 'KT001',
      tenKhoanThu: 'Phí quản lý tháng 1',
      soTien: 500000
    });

    const response = await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.maKhoanThu).toBe('KT001');
    expect(response.body.data.tenKhoanThu).toBe('Phí quản lý tháng 1');
    expect(response.body.data.soTien).toBe(500000);
  });

  // TEST 2: Fail to create khoan thu without required fields
  test('POST /khoan-thu/create should fail without required fields', async () => {
    const incompleteData = {
      tenKhoanThu: 'Phí test'
      // Missing maKhoanThu and soTien
    };

    const response = await agent
      .post('/khoan-thu/create')
      .send(incompleteData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Vui lòng điền đầy đủ thông tin bắt buộc');
  });

  // TEST 3: Fail to create duplicate maKhoanThu
  test('POST /khoan-thu/create should fail with duplicate maKhoanThu', async () => {
    const khoanThuData = global.testHelpers.createMockKhoanThu({
      maKhoanThu: 'KT001'
    });

    // Create first khoan thu
    await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    // Try to create second with same maKhoanThu
    const response = await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Mã khoản thu đã tồn tại');
  });

  // TEST 4: Get all khoan thu
  test('GET /api/khoan-thu should return all khoan thu', async () => {
    // Create some test data
    const khoanThu1 = global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' });
    const khoanThu2 = global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT002' });

    await agent.post('/khoan-thu/create').send(khoanThu1);
    await agent.post('/khoan-thu/create').send(khoanThu2);

    const response = await agent.get('/api/khoan-thu');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
  });

  // TEST 5: Get specific khoan thu by ID
  test('GET /api/khoan-thu/:id should return specific khoan thu', async () => {
    const khoanThuData = global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' });

    const createResponse = await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    const khoanThuId = createResponse.body.data._id;

    const response = await agent
      .get(`/api/khoan-thu/${khoanThuId}`);

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(khoanThuId);
    expect(response.body.maKhoanThu).toBe('KT001');
  });

  // TEST 6: Update khoan thu successfully
  test('POST /khoan-thu/:id/edit should update khoan thu successfully', async () => {
    const khoanThuData = global.testHelpers.createMockKhoanThu({ 
      maKhoanThu: 'KT001',
      soTien: 500000 
    });

    const createResponse = await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    const khoanThuId = createResponse.body.data._id;

    const updateData = {
      maKhoanThu: 'KT001',
      tenKhoanThu: 'Phí quản lý cập nhật',
      soTien: 600000,
      loaiKhoanThu: 0,
      moTa: 'Mô tả cập nhật'
    };

    const response = await agent
      .post(`/khoan-thu/${khoanThuId}/edit`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.soTien).toBe(600000);
    expect(response.body.data.tenKhoanThu).toBe('Phí quản lý cập nhật');
  });

  // TEST 7: Delete khoan thu successfully
  test('DELETE /khoan-thu/:id/delete should delete khoan thu successfully', async () => {
    const khoanThuData = global.testHelpers.createMockKhoanThu({ maKhoanThu: 'KT001' });

    const createResponse = await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    const khoanThuId = createResponse.body.data._id;

    const response = await agent
      .delete(`/khoan-thu/${khoanThuId}/delete`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Xóa khoản thu thành công');

    // Verify deletion
    const getResponse = await agent
      .get(`/api/khoan-thu/${khoanThuId}`);

    expect(getResponse.status).toBe(404);
  });

  // TEST 8: Handle non-existent khoan thu
  test('GET /api/khoan-thu/:id should return 404 for non-existent khoan thu', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const response = await agent
      .get(`/api/khoan-thu/${fakeId}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Khoản thu không tồn tại');
  });

  // TEST 9: Validate loaiKhoanThu enum values
  test('POST /khoan-thu/create should accept valid loaiKhoanThu values', async () => {
    const validTypes = [0, 1]; // 0: Bắt buộc, 1: Đóng góp tự nguyện

    for (let i = 0; i < validTypes.length; i++) {
      const khoanThuData = global.testHelpers.createMockKhoanThu({
        maKhoanThu: `KT00${i + 1}`,
        loaiKhoanThu: validTypes[i]
      });

      const response = await agent
        .post('/khoan-thu/create')
        .send(khoanThuData);

      expect(response.status).toBe(201);
      expect(response.body.data.loaiKhoanThu).toBe(validTypes[i]);
    }
  });

  // TEST 10: Date parsing functionality
  test('POST /khoan-thu/create should parse dates correctly', async () => {
    const khoanThuData = global.testHelpers.createMockKhoanThu({
      maKhoanThu: 'KT001',
      ngayTao: '15/01/2024',
      hanThanhToan: '31/01/2024'
    });

    const response = await agent
      .post('/khoan-thu/create')
      .send(khoanThuData);

    expect(response.status).toBe(201);
    
    const createdKhoanThu = response.body.data;
    const ngayTao = new Date(createdKhoanThu.ngayTao);
    const hanThanhToan = new Date(createdKhoanThu.hanThanhToan);

    expect(ngayTao.getDate()).toBe(15);
    expect(ngayTao.getMonth()).toBe(0); // January is 0
    expect(ngayTao.getFullYear()).toBe(2024);

    expect(hanThanhToan.getDate()).toBe(31);
    expect(hanThanhToan.getMonth()).toBe(0);
    expect(hanThanhToan.getFullYear()).toBe(2024);
  });

  // TEST 11: Authorization tests
  test('Should require authentication for khoan thu operations', async () => {
    const newAgent = request.agent(app);
    
    const response = await newAgent
      .get('/api/khoan-thu');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  // TEST 12: Test with monetary amounts
  test('POST /khoan-thu/create should handle various monetary amounts', async () => {
    const amounts = [100000, 500000, 1000000, 2500000.50];

    for (let i = 0; i < amounts.length; i++) {
      const khoanThuData = global.testHelpers.createMockKhoanThu({
        maKhoanThu: `KT00${i + 1}`,
        soTien: amounts[i]
      });

      const response = await agent
        .post('/khoan-thu/create')
        .send(khoanThuData);

      expect(response.status).toBe(201);
      expect(response.body.data.soTien).toBe(amounts[i]);
    }
  });
});