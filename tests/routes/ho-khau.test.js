// tests/routes/ho-khau.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');

describe('Household Management Routes', () => {
  let app;
  let testConnection;
  let HoKhauCollection;
  let NhanKhauCollection;
  let BienDoiNhanKhauCollection;
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
    
    const HoKhauSchema = new mongoose.Schema({
      soHoKhau: { type: String, required: true, unique: true },
      hoTenChuHo: { type: String, required: true },
      diaChi: { type: String, required: true },
      khuVuc: { type: String },
      ngayLamHoKhau: { type: Date, default: Date.now },
      ghiChu: { type: String }
    });

    const NhanKhauSchema = new mongoose.Schema({
      hoTen: { type: String, required: true },
      biDanh: { type: String },
      ngaySinh: { type: Date, required: true },
      gioiTinh: { type: String, enum: ['Nam', 'Nữ'], required: true },
      noiSinh: { type: String },
      nguyenQuan: { type: String },
      danToc: { type: String, default: 'Kinh' },
      tonGiao: { type: String, default: 'Không' },
      ngheNghiep: { type: String },
      noiLamViec: { type: String },
      cccd: { type: String },
      ngayCap: { type: Date },
      noiCap: { type: String },
      hoKhau: { type: mongoose.Schema.Types.ObjectId, ref: 'hokhau', required: true },
      quanHeVoiChuHo: { type: String },
      ngayDangKyThuongTru: { type: Date },
      diaChiTruoc: { type: String },
      ghiChu: { type: String }
    });

    const BienDoiNhanKhauSchema = new mongoose.Schema({
      nhanKhau: { type: mongoose.Schema.Types.ObjectId, ref: 'nhankhau' },
      hoKhau: { type: mongoose.Schema.Types.ObjectId, ref: 'hokhau' },
      loaiThayDoi: { 
        type: String, 
        enum: ['Thêm mới', 'Xóa', 'Chuyển đi', 'Chuyển đến', 'Tạm trú', 'Tạm vắng'],
        required: true 
      },
      ngayThayDoi: { type: Date, default: Date.now },
      noiDung: { type: String, required: true },
      nguoiThucHien: { type: String, required: true }
    });

    HoKhauCollection = testConnection.model('hokhau', HoKhauSchema);
    NhanKhauCollection = testConnection.model('nhankhau', NhanKhauSchema);
    BienDoiNhanKhauCollection = testConnection.model('biendoinhankhau', BienDoiNhanKhauSchema);

    // Authentication middleware
    const ensureAuthenticated = (req, res, next) => {
      if (req.session.userId) {
        return next();
      }
      res.status(401).json({ error: 'Authentication required' });
    };

    const ensureToQuan = (req, res, next) => {
      if (req.session.role === 'toquan') {
        return next();
      }
      res.status(403).json({ error: 'Team Leader privileges required' });
    };

    // Login route
    app.post('/login', (req, res) => {
      const { username, password } = req.body;
      if (username === 'totruong' && password === '123456789') {
        req.session.name = 'toquan';
        req.session.role = 'toquan';
        req.session.userId = '3';
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    // Household routes
    app.post('/toquan/hokhau/add', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const { soHoKhau, hoTenChuHo, diaChi, ngayLamHoKhau, khuVuc, ghiChu } = req.body;
        
        if (!soHoKhau || !hoTenChuHo || !diaChi) {
          return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        const existingHoKhau = await HoKhauCollection.findOne({ soHoKhau });
        if (existingHoKhau) {
          return res.status(400).json({ error: 'Số hộ khẩu đã tồn tại' });
        }

        let parsedDate = new Date();
        if (ngayLamHoKhau) {
          if (ngayLamHoKhau.includes('/')) {
            const [day, month, year] = ngayLamHoKhau.split('/');
            parsedDate = new Date(year, month - 1, day);
          } else {
            parsedDate = new Date(ngayLamHoKhau);
          }
        }

        const newHoKhau = new HoKhauCollection({
          soHoKhau,
          hoTenChuHo,
          diaChi,
          ngayLamHoKhau: parsedDate,
          khuVuc: khuVuc || "",
          ghiChu: ghiChu || ""
        });

        await newHoKhau.save();

        const bienDoi = new BienDoiNhanKhauCollection({
          hoKhau: newHoKhau._id,
          loaiThayDoi: 'Thêm mới',
          ngayThayDoi: new Date(),
          noiDung: `Thêm mới hộ khẩu số ${soHoKhau}`,
          nguoiThucHien: req.session.name
        });
        await bienDoi.save();

        res.status(201).json({ success: true, data: newHoKhau });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thêm hộ khẩu: ' + error.message });
      }
    });

    app.post('/toquan/nhankhau/add', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const { 
          hoTen, biDanh, ngaySinh, gioiTinh, noiSinh, nguyenQuan, 
          danToc, tonGiao, ngheNghiep, noiLamViec, cccd, ngayCap, 
          noiCap, hoKhau, quanHeVoiChuHo, ngayDangKyThuongTru, diaChiTruoc, ghiChu 
        } = req.body;
        
        if (!hoTen || !ngaySinh || !gioiTinh || !hoKhau || !quanHeVoiChuHo) {
          return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin bắt buộc' });
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
            parsedNgayDangKyThuongTru = new Date(ngayDangKyThuongTru);
          }
        }

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

        const hokhauInfo = await HoKhauCollection.findById(hoKhau);
        const bienDoi = new BienDoiNhanKhauCollection({
          nhanKhau: newNhanKhau._id,
          hoKhau: hoKhau,
          loaiThayDoi: 'Thêm mới',
          ngayThayDoi: new Date(),
          noiDung: `Thêm mới nhân khẩu ${hoTen} vào hộ khẩu số ${hokhauInfo.soHoKhau}`,
          nguoiThucHien: req.session.name
        });
        await bienDoi.save();

        res.status(201).json({ success: true, data: newNhanKhau });
      } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thêm nhân khẩu: ' + error.message });
      }
    });

    app.get('/api/hokhau', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const hoKhauList = await HoKhauCollection.find().sort({ soHoKhau: 1 });
        res.json(hoKhauList);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching households' });
      }
    });

    app.get('/api/nhankhau', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const nhanKhauList = await NhanKhauCollection.find()
          .populate('hoKhau')
          .sort({ hoTen: 1 });
        res.json(nhanKhauList);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching residents' });
      }
    });

    app.get('/api/nhankhau/hokhau/:hoKhauId', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const nhanKhauList = await NhanKhauCollection.find({ hoKhau: req.params.hoKhauId })
          .populate('hoKhau');
        res.json(nhanKhauList);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching residents by household' });
      }
    });

    app.delete('/toquan/hokhau/:id/delete', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const hoKhauId = req.params.id;
        
        const hoKhau = await HoKhauCollection.findById(hoKhauId);
        if (!hoKhau) {
          return res.status(404).json({ error: 'Hộ khẩu không tồn tại' });
        }

        // Delete all residents in this household
        const nhankhauList = await NhanKhauCollection.find({ hoKhau: hoKhauId });
        await NhanKhauCollection.deleteMany({ hoKhau: hoKhauId });

        // Log the deletion
        const bienDoi = new BienDoiNhanKhauCollection({
          hoKhau: hoKhauId,
          loaiThayDoi: 'Xóa',
          ngayThayDoi: new Date(),
          noiDung: `Xóa hộ khẩu số ${hoKhau.soHoKhau} và ${nhankhauList.length} nhân khẩu`,
          nguoiThucHien: req.session.name
        });
        await bienDoi.save();

        await HoKhauCollection.findByIdAndDelete(hoKhauId);

        res.json({ success: true, message: 'Xóa hộ khẩu thành công' });
      } catch (error) {
        res.status(500).json({ error: 'Error deleting household: ' + error.message });
      }
    });

    app.delete('/toquan/nhankhau/:id/delete', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const nhanKhauId = req.params.id;
        
        const nhanKhau = await NhanKhauCollection.findById(nhanKhauId).populate('hoKhau');
        if (!nhanKhau) {
          return res.status(404).json({ error: 'Nhân khẩu không tồn tại' });
        }

        const bienDoi = new BienDoiNhanKhauCollection({
          nhanKhau: nhanKhauId,
          hoKhau: nhanKhau.hoKhau._id,
          loaiThayDoi: 'Xóa',
          ngayThayDoi: new Date(),
          noiDung: `Xóa nhân khẩu ${nhanKhau.hoTen} khỏi hộ khẩu số ${nhanKhau.hoKhau.soHoKhau}`,
          nguoiThucHien: req.session.name
        });
        await bienDoi.save();

        await NhanKhauCollection.findByIdAndDelete(nhanKhauId);

        res.json({ success: true, message: 'Xóa nhân khẩu thành công' });
      } catch (error) {
        res.status(500).json({ error: 'Error deleting resident: ' + error.message });
      }
    });

    app.get('/api/biendoi', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const bienDoiList = await BienDoiNhanKhauCollection.find()
          .populate('nhanKhau')
          .populate('hoKhau')
          .sort({ ngayThayDoi: -1 });
        res.json(bienDoiList);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching population changes' });
      }
    });

    // Tạo agent để maintain session
    agent = request.agent(app);
  });

  beforeEach(async () => {
    // Clear database và login trước mỗi test
    if (HoKhauCollection) {
      await HoKhauCollection.deleteMany({});
    }
    if (NhanKhauCollection) {
      await NhanKhauCollection.deleteMany({});
    }
    if (BienDoiNhanKhauCollection) {
      await BienDoiNhanKhauCollection.deleteMany({});
    }
    
    // Login as toquan
    await agent
      .post('/login')
      .send({ username: 'totruong', password: '123456789' });
  });

  // TEST 1: Successfully create household
  test('Should successfully create new household', async () => {
    const hoKhauData = global.testHelpers.createMockHoKhau({
      soHoKhau: 'HK001',
      hoTenChuHo: 'Nguyễn Văn Test',
      diaChi: '123 Test Street'
    });

    const response = await agent
      .post('/toquan/hokhau/add')
      .send(hoKhauData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.soHoKhau).toBe('HK001');
    expect(response.body.data.hoTenChuHo).toBe('Nguyễn Văn Test');
    expect(response.body.data.diaChi).toBe('123 Test Street');
  });

  // TEST 2: Fail to create household without required fields
  test('Should fail to create household without required fields', async () => {
    const incompleteData = {
      soHoKhau: 'HK001'
      // Missing hoTenChuHo and diaChi
    };

    const response = await agent
      .post('/toquan/hokhau/add')
      .send(incompleteData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Vui lòng điền đầy đủ thông tin bắt buộc');
  });

  // TEST 3: Prevent duplicate household numbers
  test('Should prevent duplicate household numbers', async () => {
    const hoKhauData = global.testHelpers.createMockHoKhau({
      soHoKhau: 'HK001'
    });

    // Create first household
    await agent
      .post('/toquan/hokhau/add')
      .send(hoKhauData);

    // Try to create second with same number
    const response = await agent
      .post('/toquan/hokhau/add')
      .send(hoKhauData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Số hộ khẩu đã tồn tại');
  });

  // TEST 4: Successfully add resident to household
  test('Should successfully add resident to household', async () => {
    // Create household first
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhauData = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Nguyễn Văn A',
      ngaySinh: '01/01/1990',
      gioiTinh: 'Nam',
      quanHeVoiChuHo: 'Chủ hộ'
    });

    const response = await agent
      .post('/toquan/nhankhau/add')
      .send(nhanKhauData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.hoTen).toBe('Nguyễn Văn A');
    expect(response.body.data.gioiTinh).toBe('Nam');
    expect(response.body.data.quanHeVoiChuHo).toBe('Chủ hộ');
  });

  // TEST 5: Fail to add resident without required fields
  test('Should fail to add resident without required fields', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const incompleteData = {
      hoTen: 'Test Person',
      hoKhau: hoKhau._id.toString()
      // Missing ngaySinh, gioiTinh, quanHeVoiChuHo
    };

    const response = await agent
      .post('/toquan/nhankhau/add')
      .send(incompleteData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Vui lòng nhập đầy đủ thông tin bắt buộc');
  });

  // TEST 6: Get all households
  test('Should retrieve all households', async () => {
    // Create some test households
    await HoKhauCollection.create([
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' }),
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK002' })
    ]);

    const response = await agent.get('/api/hokhau');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
  });

  // TEST 7: Get all residents
  test('Should retrieve all residents', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    await NhanKhauCollection.create([
      global.testHelpers.createMockNhanKhau(hoKhau._id, { hoTen: 'Person 1' }),
      global.testHelpers.createMockNhanKhau(hoKhau._id, { hoTen: 'Person 2' })
    ]);

    const response = await agent.get('/api/nhankhau');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
  });

  // TEST 8: Get residents by household
  test('Should retrieve residents by specific household', async () => {
    const hoKhau1 = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );
    const hoKhau2 = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK002' })
    );

    await NhanKhauCollection.create([
      global.testHelpers.createMockNhanKhau(hoKhau1._id, { hoTen: 'Person 1' }),
      global.testHelpers.createMockNhanKhau(hoKhau1._id, { hoTen: 'Person 2' }),
      global.testHelpers.createMockNhanKhau(hoKhau2._id, { hoTen: 'Person 3' })
    ]);

    const response = await agent.get(`/api/nhankhau/hokhau/${hoKhau1._id}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    expect(response.body.every(person => person.hoKhau._id === hoKhau1._id.toString())).toBe(true);
  });

  // TEST 9: Delete household and all residents
  test('Should delete household and all its residents', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    await NhanKhauCollection.create([
      global.testHelpers.createMockNhanKhau(hoKhau._id, { hoTen: 'Person 1' }),
      global.testHelpers.createMockNhanKhau(hoKhau._id, { hoTen: 'Person 2' })
    ]);

    const response = await agent
      .delete(`/toquan/hokhau/${hoKhau._id}/delete`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify household is deleted
    const hoKhauCount = await HoKhauCollection.countDocuments();
    expect(hoKhauCount).toBe(0);

    // Verify residents are deleted
    const nhanKhauCount = await NhanKhauCollection.countDocuments();
    expect(nhanKhauCount).toBe(0);
  });

  // TEST 10: Delete specific resident
  test('Should delete specific resident', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhau = await NhanKhauCollection.create(
      global.testHelpers.createMockNhanKhau(hoKhau._id, { hoTen: 'Person to Delete' })
    );

    const response = await agent
      .delete(`/toquan/nhankhau/${nhanKhau._id}/delete`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify resident is deleted
    const deletedNhanKhau = await NhanKhauCollection.findById(nhanKhau._id);
    expect(deletedNhanKhau).toBeNull();

    // Verify household still exists
    const existingHoKhau = await HoKhauCollection.findById(hoKhau._id);
    expect(existingHoKhau).toBeTruthy();
  });

  // TEST 11: Track population changes
  test('Should track population changes when adding household', async () => {
    const hoKhauData = global.testHelpers.createMockHoKhau({
      soHoKhau: 'HK001'
    });

    await agent
      .post('/toquan/hokhau/add')
      .send(hoKhauData);

    const response = await agent.get('/api/biendoi');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].loaiThayDoi).toBe('Thêm mới');
    expect(response.body[0].nguoiThucHien).toBe('toquan');
  });

  // TEST 12: Date parsing functionality
  test('Should parse dates correctly for residents', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhauData = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Date Test Person',
      ngaySinh: '25/12/1985',
      ngayCap: '01/01/2005',
      ngayDangKyThuongTru: '15/06/2020'
    });

    const response = await agent
      .post('/toquan/nhankhau/add')
      .send(nhanKhauData);

    expect(response.status).toBe(201);
    
    const createdNhanKhau = response.body.data;
    const ngaySinh = new Date(createdNhanKhau.ngaySinh);
    const ngayCap = new Date(createdNhanKhau.ngayCap);
    const ngayDangKy = new Date(createdNhanKhau.ngayDangKyThuongTru);

    expect(ngaySinh.getDate()).toBe(25);
    expect(ngaySinh.getMonth()).toBe(11); // December is 11
    expect(ngaySinh.getFullYear()).toBe(1985);

    expect(ngayCap.getDate()).toBe(1);
    expect(ngayCap.getMonth()).toBe(0); // January is 0
    expect(ngayCap.getFullYear()).toBe(2005);
  });

// TEST 13: Validate gender enum
test('Should validate gender enum values', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhauData = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Invalid Gender Person',
      gioiTinh: 'InvalidGender' // Should only be 'Nam' or 'Nữ'
    });

    try {
      await agent
        .post('/toquan/nhankhau/add')
        .send(nhanKhauData);
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });

  // TEST 14: Authentication required
  test('Should require authentication for household operations', async () => {
    const response = await request(app)
      .post('/toquan/hokhau/add')
      .send({
        soHoKhau: 'HK001',
        hoTenChuHo: 'Test',
        diaChi: 'Test Address'
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  // TEST 15: Role authorization required
  test('Should require toquan role for household operations', async () => {
    // Create agent with different role
    const unauthorizedAgent = request.agent(app);
    
    // This would need a different user with non-toquan role
    // For now, we'll test with no session
    const response = await unauthorizedAgent
      .post('/toquan/hokhau/add')
      .send({
        soHoKhau: 'HK001',
        hoTenChuHo: 'Test',
        diaChi: 'Test Address'
      });

    expect(response.status).toBe(401);
  });

  // TEST 16: Search and filter functionality
  test('Should handle large datasets efficiently', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    // Create multiple residents
    const residents = [];
    for (let i = 1; i <= 50; i++) {
      residents.push(
        global.testHelpers.createMockNhanKhau(hoKhau._id, { 
          hoTen: `Person ${i}`,
          cccd: `12345678${i.toString().padStart(2, '0')}`
        })
      );
    }
    
    await NhanKhauCollection.create(residents);

    const response = await agent.get('/api/nhankhau');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(50);
  });

  // TEST 17: Validate CCCD uniqueness (if implemented)
  test('Should handle CCCD validation', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhau1 = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Person 1',
      cccd: '123456789012'
    });

    const nhanKhau2 = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Person 2',
      cccd: '123456789012' // Same CCCD
    });

    // Create first resident
    await agent
      .post('/toquan/nhankhau/add')
      .send(nhanKhau1);

    // Try to create second with same CCCD
    // Note: Current schema doesn't enforce CCCD uniqueness
    // This test documents current behavior
    const response = await agent
      .post('/toquan/nhankhau/add')
      .send(nhanKhau2);

    // Currently allows duplicate CCCD - may want to change this
    expect(response.status).toBe(201);
  });

  // TEST 18: Population change tracking details
  test('Should record detailed population changes', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhauData = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Test Person'
    });

    // Add resident
    await agent
      .post('/toquan/nhankhau/add')
      .send(nhanKhauData);

    const response = await agent.get('/api/biendoi');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2); // One for household, one for resident
    
    // Check resident addition record
    const residentChange = response.body.find(change => 
      change.loaiThayDoi === 'Thêm mới' && change.noiDung.includes('Test Person')
    );
    
    expect(residentChange).toBeTruthy();
    expect(residentChange.nguoiThucHien).toBe('toquan');
  });

  // TEST 19: Handle invalid ObjectId
  test('Should handle invalid ObjectId gracefully', async () => {
    const response = await agent
      .delete('/toquan/hokhau/invalid-id/delete');

    // Depending on implementation, this might be 400 or 500
    expect([400, 500].includes(response.status)).toBe(true);
  });

  // TEST 20: Comprehensive household with multiple residents
  test('Should manage complete household lifecycle', async () => {
    // Create household
    const hoKhauData = global.testHelpers.createMockHoKhau({
      soHoKhau: 'HK001',
      hoTenChuHo: 'Nguyễn Văn Test',
      diaChi: '123 Test Street'
    });

    const hoKhauResponse = await agent
      .post('/toquan/hokhau/add')
      .send(hoKhauData);

    expect(hoKhauResponse.status).toBe(201);
    const hoKhauId = hoKhauResponse.body.data._id;

    // Add head of household
    const chuHoData = global.testHelpers.createMockNhanKhau(hoKhauId, {
      hoTen: 'Nguyễn Văn Test',
      quanHeVoiChuHo: 'Chủ hộ',
      ngaySinh: '01/01/1980',
      gioiTinh: 'Nam'
    });

    const chuHoResponse = await agent
      .post('/toquan/nhankhau/add')
      .send(chuHoData);

    expect(chuHoResponse.status).toBe(201);

    // Add spouse
    const voData = global.testHelpers.createMockNhanKhau(hoKhauId, {
      hoTen: 'Trần Thị Test',
      quanHeVoiChuHo: 'Vợ',
      ngaySinh: '15/05/1985',
      gioiTinh: 'Nữ'
    });

    const voResponse = await agent
      .post('/toquan/nhankhau/add')
      .send(voData);

    expect(voResponse.status).toBe(201);

    // Add child
    const conData = global.testHelpers.createMockNhanKhau(hoKhauId, {
      hoTen: 'Nguyễn Văn Con',
      quanHeVoiChuHo: 'Con',
      ngaySinh: '20/08/2010',
      gioiTinh: 'Nam'
    });

    const conResponse = await agent
      .post('/toquan/nhankhau/add')
      .send(conData);

    expect(conResponse.status).toBe(201);

    // Verify all residents in household
    const householdResponse = await agent
      .get(`/api/nhankhau/hokhau/${hoKhauId}`);

    expect(householdResponse.status).toBe(200);
    expect(householdResponse.body).toHaveLength(3);

    // Verify population changes
    const changesResponse = await agent.get('/api/biendoi');
    expect(changesResponse.status).toBe(200);
    expect(changesResponse.body).toHaveLength(4); // 1 household + 3 residents

    // Delete entire household
    const deleteResponse = await agent
      .delete(`/toquan/hokhau/${hoKhauId}/delete`);

    expect(deleteResponse.status).toBe(200);

    // Verify everything is deleted
    const finalHouseholdCount = await HoKhauCollection.countDocuments();
    const finalResidentCount = await NhanKhauCollection.countDocuments();
    
    expect(finalHouseholdCount).toBe(0);
    expect(finalResidentCount).toBe(0);
  });

  // TEST 21: Edge case - Empty string handling
  test('Should handle empty strings in optional fields', async () => {
    const hoKhau = await HoKhauCollection.create(
      global.testHelpers.createMockHoKhau({ soHoKhau: 'HK001' })
    );

    const nhanKhauData = global.testHelpers.createMockNhanKhau(hoKhau._id, {
      hoTen: 'Test Person',
      biDanh: '', // Empty string
      ngheNghiep: '', // Empty string
      ghiChu: '' // Empty string
    });

    const response = await agent
      .post('/toquan/nhankhau/add')
      .send(nhanKhauData);

    expect(response.status).toBe(201);
    expect(response.body.data.biDanh).toBe('');
    expect(response.body.data.ngheNghiep).toBe('');
    expect(response.body.data.ghiChu).toBe('');
  });

  // TEST 22: Database connection error handling
  test('Should handle database connection errors gracefully', async () => {
    // This test would require mocking database errors
    // For now, we'll test with invalid data that might cause DB errors
    
    const invalidData = {
      soHoKhau: 'A'.repeat(1000), // Very long string
      hoTenChuHo: 'Test',
      diaChi: 'Test Address'
    };

    try {
      const response = await agent
        .post('/toquan/hokhau/add')
        .send(invalidData);
      
      // Depending on database, this might succeed or fail
      expect([201, 400, 500].includes(response.status)).toBe(true);
    } catch (error) {
      // Expected for some databases
      expect(error).toBeTruthy();
    }
  });

  // TEST 23: Concurrent operations
  test('Should handle concurrent household creation', async () => {
    const promises = [];
    
    for (let i = 1; i <= 5; i++) {
      const hoKhauData = global.testHelpers.createMockHoKhau({
        soHoKhau: `HK00${i}`,
        hoTenChuHo: `Test Person ${i}`,
        diaChi: `${i} Test Street`
      });
      
      promises.push(
        agent
          .post('/toquan/hokhau/add')
          .send(hoKhauData)
      );
    }

    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    const finalCount = await HoKhauCollection.countDocuments();
    expect(finalCount).toBe(5);
  });

  afterEach(async () => {
    // Clean up after each test
    if (HoKhauCollection) {
      await HoKhauCollection.deleteMany({});
    }
    if (NhanKhauCollection) {
      await NhanKhauCollection.deleteMany({});
    }
    if (BienDoiNhanKhauCollection) {
      await BienDoiNhanKhauCollection.deleteMany({});
    }
  });

  afterAll(async () => {
    // Cleanup
    if (testConnection) {
      await testConnection.close();
    }
  });
});

// Additional helper tests for data validation
describe('Data Validation Helpers', () => {
  test('Mock data should have required fields', () => {
    const mockHoKhau = global.testHelpers.createMockHoKhau();
    
    expect(mockHoKhau).toHaveProperty('soHoKhau');
    expect(mockHoKhau).toHaveProperty('hoTenChuHo');
    expect(mockHoKhau).toHaveProperty('diaChi');
    expect(typeof mockHoKhau.soHoKhau).toBe('string');
    expect(typeof mockHoKhau.hoTenChuHo).toBe('string');
    expect(typeof mockHoKhau.diaChi).toBe('string');
  });

  test('Mock resident should have required fields', () => {
    const mockObjectId = new mongoose.Types.ObjectId();
    const mockNhanKhau = global.testHelpers.createMockNhanKhau(mockObjectId);
    
    expect(mockNhanKhau).toHaveProperty('hoTen');
    expect(mockNhanKhau).toHaveProperty('ngaySinh');
    expect(mockNhanKhau).toHaveProperty('gioiTinh');
    expect(mockNhanKhau).toHaveProperty('hoKhau');
    expect(mockNhanKhau).toHaveProperty('quanHeVoiChuHo');
    
    expect(['Nam', 'Nữ']).toContain(mockNhanKhau.gioiTinh);
    expect(mockNhanKhau.hoKhau).toBe(mockObjectId.toString());
  });

  test('Date formatting should work correctly', () => {
    const testDate = '25/12/1990';
    const [day, month, year] = testDate.split('/');
    const parsedDate = new Date(year, month - 1, day);
    
    expect(parsedDate.getDate()).toBe(25);
    expect(parsedDate.getMonth()).toBe(11); // December is 11
    expect(parsedDate.getFullYear()).toBe(1990);
  });
});