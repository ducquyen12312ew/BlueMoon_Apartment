// tests/utils/test-utils.test.js
const mongoose = require('mongoose');

describe('Test Utility Functions', () => {
  
  // TEST 1: Test helper function createMockUser
  test('createMockUser should create valid user data', () => {
    const mockUser = global.testHelpers.createMockUser();
    
    expect(mockUser).toHaveProperty('name');
    expect(mockUser).toHaveProperty('password');
    expect(mockUser).toHaveProperty('email');
    expect(mockUser).toHaveProperty('phone');
    expect(mockUser).toHaveProperty('position');
    expect(mockUser).toHaveProperty('role');
    
    expect(mockUser.name).toBe('Test User');
    expect(mockUser.password).toBe('123456789');
    expect(mockUser.role).toBe('admin');
  });

  // TEST 2: Test helper function with overrides
  test('createMockUser should accept overrides', () => {
    const overrides = {
      name: 'Custom User',
      role: 'cudan',
      email: 'custom@test.com'
    };
    
    const mockUser = global.testHelpers.createMockUser(overrides);
    
    expect(mockUser.name).toBe('Custom User');
    expect(mockUser.role).toBe('cudan');
    expect(mockUser.email).toBe('custom@test.com');
    expect(mockUser.password).toBe('123456789'); // Should keep default
  });

  // TEST 3: Test createMockKhoanThu helper
  test('createMockKhoanThu should create valid khoan thu data', () => {
    const mockKhoanThu = global.testHelpers.createMockKhoanThu();
    
    expect(mockKhoanThu).toHaveProperty('maKhoanThu');
    expect(mockKhoanThu).toHaveProperty('tenKhoanThu');
    expect(mockKhoanThu).toHaveProperty('soTien');
    expect(mockKhoanThu).toHaveProperty('loaiKhoanThu');
    expect(mockKhoanThu).toHaveProperty('ngayTao');
    expect(mockKhoanThu).toHaveProperty('hanThanhToan');
    
    expect(mockKhoanThu.maKhoanThu).toBe('KT001');
    expect(mockKhoanThu.soTien).toBe(500000);
    expect(mockKhoanThu.loaiKhoanThu).toBe(0);
    expect(mockKhoanThu.ngayTao).toBeInstanceOf(Date);
  });

  // TEST 4: Test createMockHoKhau helper
  test('createMockHoKhau should create valid household data', () => {
    const mockHoKhau = global.testHelpers.createMockHoKhau();
    
    expect(mockHoKhau).toHaveProperty('soHoKhau');
    expect(mockHoKhau).toHaveProperty('hoTenChuHo');
    expect(mockHoKhau).toHaveProperty('diaChi');
    expect(mockHoKhau).toHaveProperty('ngayLamHoKhau');
    
    expect(mockHoKhau.soHoKhau).toBe('HK001');
    expect(mockHoKhau.hoTenChuHo).toBe('Nguyễn Văn Test');
    expect(mockHoKhau.diaChi).toBe('123 Test Street');
    expect(mockHoKhau.ngayLamHoKhau).toBeInstanceOf(Date);
  });

  // TEST 5: Test createMockNhanKhau helper
  test('createMockNhanKhau should create valid resident data', () => {
    const hoKhauId = new mongoose.Types.ObjectId();
    const mockNhanKhau = global.testHelpers.createMockNhanKhau(hoKhauId);
    
    expect(mockNhanKhau).toHaveProperty('hoTen');
    expect(mockNhanKhau).toHaveProperty('ngaySinh');
    expect(mockNhanKhau).toHaveProperty('gioiTinh');
    expect(mockNhanKhau).toHaveProperty('hoKhau');
    expect(mockNhanKhau).toHaveProperty('quanHeVoiChuHo');
    
    expect(mockNhanKhau.hoTen).toBe('Test Person');
    expect(mockNhanKhau.ngaySinh).toBeInstanceOf(Date);
    expect(mockNhanKhau.gioiTinh).toBe('Nam');
    expect(mockNhanKhau.hoKhau).toEqual(hoKhauId);
    expect(mockNhanKhau.quanHeVoiChuHo).toBe('Chủ hộ');
  });

  // TEST 6: Test createMockFeedback helper
  test('createMockFeedback should create valid feedback data', () => {
    const mockFeedback = global.testHelpers.createMockFeedback();
    
    expect(mockFeedback).toHaveProperty('resident');
    expect(mockFeedback).toHaveProperty('apartment');
    expect(mockFeedback).toHaveProperty('title');
    expect(mockFeedback).toHaveProperty('description');
    expect(mockFeedback).toHaveProperty('category');
    expect(mockFeedback).toHaveProperty('status');
    
    expect(mockFeedback.resident).toBe('Test Resident');
    expect(mockFeedback.apartment).toBe('A101');
    expect(mockFeedback.title).toBe('Test Feedback');
    expect(mockFeedback.category).toBe('maintenance');
    expect(mockFeedback.status).toBe('pending');
  });

  // TEST 7: Test MongoDB ObjectId generation
  test('Should generate valid MongoDB ObjectIds', () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    
    expect(id1).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(id2).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(id1.toString()).not.toBe(id2.toString());
    expect(mongoose.Types.ObjectId.isValid(id1)).toBe(true);
    expect(mongoose.Types.ObjectId.isValid(id2)).toBe(true);
  });

  // TEST 8: Test date manipulation utilities
  test('Should handle date manipulations correctly', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    expect(tomorrow.getTime()).toBeGreaterThan(today.getTime());
    expect(yesterday.getTime()).toBeLessThan(today.getTime());
    
    // Test date formatting
    const formattedDate = today.toLocaleDateString('vi-VN');
    expect(typeof formattedDate).toBe('string');
    expect(formattedDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  // TEST 9: Test Vietnamese currency formatting
  test('Should format Vietnamese currency correctly', () => {
    const amount1 = 500000;
    const amount2 = 1000000;
    const amount3 = 2500000.50;
    
    const formatted1 = amount1.toLocaleString('vi-VN');
    const formatted2 = amount2.toLocaleString('vi-VN');
    const formatted3 = amount3.toLocaleString('vi-VN');
    
    expect(formatted1).toBe('500.000');
    expect(formatted2).toBe('1.000.000');
    expect(formatted3).toBe('2.500.000,5');
  });

  // TEST 10: Test array manipulation utilities
  test('Should manipulate arrays correctly', () => {
    const testArray = [1, 2, 3, 4, 5];
    
    // Test array methods
    expect(testArray.length).toBe(5);
    expect(testArray.includes(3)).toBe(true);
    expect(testArray.includes(6)).toBe(false);
    
    // Test filtering
    const evenNumbers = testArray.filter(n => n % 2 === 0);
    expect(evenNumbers).toEqual([2, 4]);
    
    // Test mapping
    const doubled = testArray.map(n => n * 2);
    expect(doubled).toEqual([2, 4, 6, 8, 10]);
    
    // Test reducing
    const sum = testArray.reduce((acc, n) => acc + n, 0);
    expect(sum).toBe(15);
  });

  // TEST 11: Test string manipulation utilities
  test('Should manipulate strings correctly', () => {
    const testString = 'Test String';
    
    expect(testString.toLowerCase()).toBe('test string');
    expect(testString.toUpperCase()).toBe('TEST STRING');
    expect(testString.length).toBe(11);
    expect(testString.includes('Test')).toBe(true);
    expect(testString.startsWith('Test')).toBe(true);
    expect(testString.endsWith('String')).toBe(true);
    
    // Test trimming
    const spacedString = '  spaced  ';
    expect(spacedString.trim()).toBe('spaced');
    
    // Test splitting
    const csvString = 'a,b,c,d';
    const parts = csvString.split(',');
    expect(parts).toEqual(['a', 'b', 'c', 'd']);
  });

  // TEST 12: Test phone number validation regex
  test('Should validate phone numbers correctly', () => {
    const phonePattern = /^(0|\+84)(\d{9,10})$/;
    
    const validPhones = [
      '0123456789',
      '0987654321',
      '+84123456789',
      '+84987654321'
    ];
    
    const invalidPhones = [
      '123456789',
      '012345678',
      '01234567890',
      'abc123456789',
      '+841234567890'
    ];
    
    validPhones.forEach(phone => {
      expect(phonePattern.test(phone)).toBe(true);
    });
    
    invalidPhones.forEach(phone => {
      expect(phonePattern.test(phone)).toBe(false);
    });
  });

  // TEST 13: Test email validation regex
  test('Should validate emails correctly', () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    const validEmails = [
      'test@example.com',
      'user.name@domain.com',
      'user+tag@example.org',
      'user123@test-domain.co.uk'
    ];
    
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@domain',
      'user name@domain.com',
      'user@domain..com'
    ];
    
    validEmails.forEach(email => {
      expect(emailPattern.test(email)).toBe(true);
    });
    
    invalidEmails.forEach(email => {
      expect(emailPattern.test(email)).toBe(false);
    });
  });

  // TEST 14: Test ID number validation regex
  test('Should validate Vietnamese ID numbers correctly', () => {
    const idNumberPattern = /^\d{9,12}$/;
    
    const validIds = [
      '123456789',      // 9 digits
      '1234567890',     // 10 digits
      '12345678901',    // 11 digits
      '123456789012'    // 12 digits
    ];
    
    const invalidIds = [
      '12345678',       // 8 digits (too short)
      '1234567890123',  // 13 digits (too long)
      '12345678a',      // contains letter
      '123-456-789',    // contains dashes
      '123 456 789'     // contains spaces
    ];
    
    validIds.forEach(id => {
      expect(idNumberPattern.test(id)).toBe(true);
    });
    
    invalidIds.forEach(id => {
      expect(idNumberPattern.test(id)).toBe(false);
    });
  });

  // TEST 15: Test date parsing utilities
  test('Should parse Vietnamese date format correctly', () => {
    const dateString = '25/12/2023';
    const [day, month, year] = dateString.split('/');
    const parsedDate = new Date(year, month - 1, day);
    
    expect(parsedDate.getDate()).toBe(25);
    expect(parsedDate.getMonth()).toBe(11); // December is 11
    expect(parsedDate.getFullYear()).toBe(2023);
    
    // Test invalid date string
    const invalidDateString = 'invalid-date';
    const invalidParts = invalidDateString.split('/');
    expect(invalidParts).toHaveLength(1); // Should not split correctly
  });

  // TEST 16: Test number utilities
  test('Should handle number operations correctly', () => {
    const num1 = 123.456;
    const num2 = 789.123;
    
    // Test rounding
    expect(Math.round(num1)).toBe(123);
    expect(Math.ceil(num1)).toBe(124);
    expect(Math.floor(num1)).toBe(123);
    
    // Test fixed decimal places
    expect(num1.toFixed(2)).toBe('123.46');
    expect(num2.toFixed(0)).toBe('789');
    
    // Test parsing
    expect(parseInt('123.456')).toBe(123);
    expect(parseFloat('123.456')).toBe(123.456);
    expect(Number('123.456')).toBe(123.456);
    
    // Test NaN checking
    expect(isNaN(NaN)).toBe(true);
    expect(isNaN(123)).toBe(false);
    expect(isNaN('abc')).toBe(true);
    expect(Number.isNaN(NaN)).toBe(true);
    expect(Number.isNaN(123)).toBe(false);
  });

  // TEST 17: Test payment status enum validation
  test('Should validate payment status values', () => {
    const validStatuses = ['on-time', 'late', 'partial'];
    const invalidStatuses = ['early', 'pending', 'cancelled', ''];
    
    validStatuses.forEach(status => {
      expect(['on-time', 'late', 'partial'].includes(status)).toBe(true);
    });
    
    invalidStatuses.forEach(status => {
      expect(['on-time', 'late', 'partial'].includes(status)).toBe(false);
    });
  });

  // TEST 18: Test feedback category validation
  test('Should validate feedback categories', () => {
    const validCategories = ['maintenance', 'security', 'neighbor', 'facilities', 'payment', 'other'];
    const invalidCategories = ['invalid', 'unknown', '', 'test'];
    
    validCategories.forEach(category => {
      expect(['maintenance', 'security', 'neighbor', 'facilities', 'payment', 'other'].includes(category)).toBe(true);
    });
    
    invalidCategories.forEach(category => {
      expect(['maintenance', 'security', 'neighbor', 'facilities', 'payment', 'other'].includes(category)).toBe(false);
    });
  });

  // TEST 19: Test MongoDB connection state
  test('Should validate MongoDB connection states', () => {
    const connectionStates = mongoose.Connection.STATES;
    
    expect(connectionStates.disconnected).toBe(0);
    expect(connectionStates.connected).toBe(1);
    expect(connectionStates.connecting).toBe(2);
    expect(connectionStates.disconnecting).toBe(3);
    
    // Test current connection state
    const testConnection = global.testConfig.testConnection;
    expect(testConnection).toBeDefined();
    expect(testConnection.readyState).toBe(1); // Should be connected
  });

  // TEST 20: Test error handling utilities
  test('Should handle errors correctly', () => {
    try {
      throw new Error('Test error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(typeof error.stack).toBe('string');
    }
    
    // Test custom error
    class CustomError extends Error {
      constructor(message, code) {
        super(message);
        this.name = 'CustomError';
        this.code = code;
      }
    }
    
    try {
      throw new CustomError('Custom test error', 'TEST_ERROR');
    } catch (error) {
      expect(error).toBeInstanceOf(CustomError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('CustomError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Custom test error');
    }
  });

  // TEST 21: Test async utilities
  test('Should handle async operations correctly', async () => {
    // Test Promise.resolve
    const resolvedValue = await Promise.resolve('test value');
    expect(resolvedValue).toBe('test value');
    
    // Test Promise.reject
    try {
      await Promise.reject(new Error('test error'));
    } catch (error) {
      expect(error.message).toBe('test error');
    }
    
    // Test timeout simulation
    const delayedValue = await new Promise(resolve => {
      setTimeout(() => resolve('delayed'), 10);
    });
    expect(delayedValue).toBe('delayed');
  });

  // TEST 22: Test environment setup
  test('Should have correct test environment setup', () => {
    expect(global.testConfig).toBeDefined();
    expect(global.testConfig.mongoServer).toBeDefined();
    expect(global.testConfig.testConnection).toBeDefined();
    expect(global.testHelpers).toBeDefined();
    
    // Test helper functions exist
    expect(typeof global.testHelpers.createMockUser).toBe('function');
    expect(typeof global.testHelpers.createMockKhoanThu).toBe('function');
    expect(typeof global.testHelpers.createMockHoKhau).toBe('function');
    expect(typeof global.testHelpers.createMockNhanKhau).toBe('function');
    expect(typeof global.testHelpers.createMockFeedback).toBe('function');
  });
});