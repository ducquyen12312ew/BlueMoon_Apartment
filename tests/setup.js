const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Global test configuration
global.testConfig = {
  mongoServer: null,
  testConnection: null
};

// Setup before all tests
beforeAll(async () => {
  // Tạo MongoMemoryServer instance
  global.testConfig.mongoServer = await MongoMemoryServer.create();
  const mongoUri = global.testConfig.mongoServer.getUri();
  
  // Thiết lập connection cho test
  global.testConfig.testConnection = mongoose.createConnection(mongoUri);
  
  // Set timeout cho các test
  jest.setTimeout(30000);
  
  console.log('🗃️  Connected to in-memory MongoDB for testing');
});

// Cleanup sau khi chạy xong tất cả tests
afterAll(async () => {
  if (global.testConfig.testConnection) {
    await global.testConfig.testConnection.close();
  }
  if (global.testConfig.mongoServer) {
    await global.testConfig.mongoServer.stop();
  }
  
  console.log('🗃️  Disconnected from in-memory MongoDB');
});

// Cleanup after each test
afterEach(async () => {
  // Clean up collections after each test if needed
  if (global.testConfig && global.testConfig.testConnection) {
    const collections = await global.testConfig.testConnection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// Helper functions cho tests
global.testHelpers = {
  // Tạo user data mẫu
  createMockUser: (overrides = {}) => ({
    name: 'Test User',
    password: '123456789',
    email: 'test@example.com',
    phone: '0123456789',
    position: 'Quản lý',
    role: 'admin',
    ...overrides
  }),

  // Tạo khoan thu data mẫu
  createMockKhoanThu: (overrides = {}) => ({
    maKhoanThu: 'KT001',
    tenKhoanThu: 'Phí quản lý test',
    soTien: 500000,
    loaiKhoanThu: 0,
    ngayTao: new Date(),
    hanThanhToan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    moTa: 'Mô tả test',
    ...overrides
  }),

  // Tạo ho khau data mẫu
  createMockHoKhau: (overrides = {}) => ({
    soHoKhau: 'HK001',
    hoTenChuHo: 'Nguyễn Văn Test',
    diaChi: '123 Test Street',
    ngayLamHoKhau: new Date(),
    ghiChu: 'Test note',
    ...overrides
  }),

  // Tạo nhan khau data mẫu
  createMockNhanKhau: (hoKhauId, overrides = {}) => ({
    hoTen: 'Test Person',
    ngaySinh: new Date('1990-01-01'),
    gioiTinh: 'Nam',
    hoKhau: hoKhauId,
    quanHeVoiChuHo: 'Chủ hộ',
    ...overrides
  }),

  // Tạo feedback data mẫu
  createMockFeedback: (overrides = {}) => ({
    resident: 'Test Resident',
    apartment: 'A101',
    title: 'Test Feedback',
    description: 'Test description',
    category: 'maintenance',
    status: 'pending',
    ...overrides
  }),

  // Tạo payment data mẫu
  createMockPayment: (khoanThuId, overrides = {}) => ({
    khoanThu: khoanThuId,
    tenNguoiNop: 'Test Resident',
    ngayNop: new Date(),
    soTien: 500000,
    phuongThucThanhToan: 'cash',
    nguoiThu: 'test-admin',
    canHo: 'A101',
    trangThai: 'on-time',
    ...overrides
  }),

  // Tạo resident profile data mẫu
  createMockResidentProfile: (overrides = {}) => ({
    userId: 'test-user-id',
    name: 'Test Resident',
    apartment: 'A101',
    dateOfBirth: '01/01/1990',
    phone: '0909123456',
    email: 'resident@test.com',
    idNumber: '001234567890',
    moveInDate: '01/01/2023',
    ...overrides
  }),

  // Generate random string
  randomString: (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Wait function
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Format date to Vietnamese format
  formatDateVN: (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  },

  // Create test session data
  createTestSession: (userType = 'admin') => {
    const sessions = {
      admin: { userId: '1', role: 'admin', name: 'test-admin' },
      toquan: { userId: '3', role: 'toquan', name: 'test-toquan' },
      topho: { userId: '4', role: 'topho', name: 'test-topho' },
      cudan: { userId: '10', role: 'cudan', name: 'test-cudan' }
    };
    
    return sessions[userType] || sessions.admin;
  }
};

// Custom matchers for better testing
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },
  
  toHaveValidDate(received) {
    const pass = received instanceof Date && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Date`,
        pass: false,
      };
    }
  },

  toBeValidVietnameseDate(received) {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    const pass = typeof received === 'string' && datePattern.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Vietnamese date format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Vietnamese date format (dd/mm/yyyy)`,
        pass: false,
      };
    }
  }
});

// Global test utilities that can be used across all tests
global.testUtils = {
  createTestUser: (role = 'admin', overrides = {}) => ({
    name: `Test ${role}`,
    password: '123456789',
    email: `test-${role}@bluemoon.com`,
    phone: '0909123456',
    position: role === 'admin' ? 'Quản lý' : 'Nhân viên',
    role,
    ...overrides
  }),
  
  createTestKhoanThu: (overrides = {}) => ({
    maKhoanThu: `TEST${Date.now()}`,
    tenKhoanThu: 'Test Fee',
    soTien: 500000,
    loaiKhoanThu: 0,
    ngayTao: new Date(),
    hanThanhToan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    moTa: 'Test description',
    ...overrides
  }),
  
  createTestPayment: (khoanThuId, overrides = {}) => ({
    khoanThu: khoanThuId,
    tenNguoiNop: 'Test Resident',
    ngayNop: new Date(),
    soTien: 500000,
    phuongThucThanhToan: 'cash',
    nguoiThu: 'test-admin',
    canHo: 'A101',
    trangThai: 'on-time',
    ...overrides
  }),
  
  randomString: (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock console methods để tránh spam trong test output (optional)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Suppress MongoDB connection warnings during tests
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('DeprecationWarning')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('DeprecationWarning')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};