// tests/routes/auth.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');

describe('Authentication Routes', () => {
  let app;
  let testConnection;
  let UserCollection;

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

    // Tạo connection và schema cho test
    testConnection = global.testConfig.testConnection;
    
    const UserSchema = new mongoose.Schema({
      name: { type: String, required: true },
      password: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      position: { type: String, default: 'Quản lý' },
      role: { type: String, enum: ['admin', 'toquan', 'topho', 'cudan'], default: 'admin' },
      createdAt: { type: Date, default: Date.now }
    });

    UserCollection = testConnection.model('users', UserSchema);

    // Auth routes
    app.get('/login', (req, res) => {
      res.status(200).json({ message: 'Login page' });
    });

    app.post('/login', async (req, res) => {
      try {
        const { username, password } = req.body;

        // Hardcoded users for testing
        const users = {
          'ketoan': { id: '1', name: 'admin', role: 'admin', password: '123456789' },
          'totruong': { id: '3', name: 'toquan', role: 'toquan', password: '123456789' },
          'topho': { id: '4', name: 'topho', role: 'topho', password: '123456789' },
          'cudan1': { id: '10', name: 'cudan', role: 'cudan', password: '123456789' }
        };

        const user = users[username];
        
        if (user && user.password === password) {
          req.session.name = user.name;
          req.session.role = user.role;
          req.session.userId = user.id;
          
          return res.status(200).json({ 
            success: true, 
            message: 'Login successful',
            user: { name: user.name, role: user.role, id: user.id }
          });
        } else {
          return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Login error' });
      }
    });

    app.get('/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Error during logout' });
        }
        res.status(200).json({ message: 'Logout successful' });
      });
    });

    // Protected route for testing
    app.get('/protected', (req, res) => {
      if (req.session.userId) {
        res.status(200).json({ 
          message: 'Protected content', 
          user: { 
            name: req.session.name, 
            role: req.session.role, 
            id: req.session.userId 
          }
        });
      } else {
        res.status(401).json({ error: 'Access denied' });
      }
    });
  });

  beforeEach(async () => {
    // Clear session và database trước mỗi test
    if (UserCollection) {
      await UserCollection.deleteMany({});
    }
  });

  // TEST 1: Login page accessibility
  test('GET /login should return login page', async () => {
    const response = await request(app)
      .get('/login');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Login page');
  });

  // TEST 2: Successful login with admin credentials
  test('POST /login should succeed with valid admin credentials', async () => {
    const credentials = {
      username: 'ketoan',
      password: '123456789'
    };

    const response = await request(app)
      .post('/login')
      .send(credentials);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Login successful');
    expect(response.body.user).toEqual({
      name: 'admin',
      role: 'admin',
      id: '1'
    });
  });

  // TEST 3: Successful login with toquan credentials
  test('POST /login should succeed with valid toquan credentials', async () => {
    const credentials = {
      username: 'totruong',
      password: '123456789'
    };

    const response = await request(app)
      .post('/login')
      .send(credentials);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe('toquan');
  });

  // TEST 4: Successful login with cudan credentials
  test('POST /login should succeed with valid cudan credentials', async () => {
    const credentials = {
      username: 'cudan1',
      password: '123456789'
    };

    const response = await request(app)
      .post('/login')
      .send(credentials);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe('cudan');
  });

  // TEST 5: Failed login with invalid username
  test('POST /login should fail with invalid username', async () => {
    const credentials = {
      username: 'invaliduser',
      password: '123456789'
    };

    const response = await request(app)
      .post('/login')
      .send(credentials);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Tài khoản hoặc mật khẩu không chính xác');
  });

  // TEST 6: Failed login with invalid password
  test('POST /login should fail with invalid password', async () => {
    const credentials = {
      username: 'ketoan',
      password: 'wrongpassword'
    };

    const response = await request(app)
      .post('/login')
      .send(credentials);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Tài khoản hoặc mật khẩu không chính xác');
  });

  // TEST 7: Failed login with missing credentials
  test('POST /login should fail with missing credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Tài khoản hoặc mật khẩu không chính xác');
  });

  // TEST 8: Session persistence after login
  test('Session should persist after successful login', async () => {
    const agent = request.agent(app);
    
    // Login first
    const loginResponse = await agent
      .post('/login')
      .send({ username: 'ketoan', password: '123456789' });

    expect(loginResponse.status).toBe(200);

    // Access protected route
    const protectedResponse = await agent
      .get('/protected');

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body.message).toBe('Protected content');
    expect(protectedResponse.body.user.name).toBe('admin');
  });

  // TEST 9: Access protected route without login
  test('Protected route should deny access without login', async () => {
    const response = await request(app)
      .get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Access denied');
  });

  // TEST 10: Successful logout
  test('GET /logout should destroy session', async () => {
    const agent = request.agent(app);
    
    // Login first
    await agent
      .post('/login')
      .send({ username: 'ketoan', password: '123456789' });

    // Logout
    const logoutResponse = await agent
      .get('/logout');

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe('Logout successful');

    // Try to access protected route after logout
    const protectedResponse = await agent
      .get('/protected');

    expect(protectedResponse.status).toBe(401);
  });

  // TEST 11: Multiple user roles validation
  test('Should correctly identify different user roles', async () => {
    const testUsers = [
      { username: 'ketoan', expectedRole: 'admin' },
      { username: 'totruong', expectedRole: 'toquan' },
      { username: 'topho', expectedRole: 'topho' },
      { username: 'cudan1', expectedRole: 'cudan' }
    ];

    for (const testUser of testUsers) {
      const response = await request(app)
        .post('/login')
        .send({ username: testUser.username, password: '123456789' });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe(testUser.expectedRole);
    }
  });

  // TEST 12: Login input validation
  test('Should handle malformed login requests', async () => {
    const malformedRequests = [
      { username: null, password: '123456789' },
      { username: 'ketoan', password: null },
      { username: '', password: '' },
      { username: '   ', password: '   ' }
    ];

    for (const request_data of malformedRequests) {
      const response = await request(app)
        .post('/login')
        .send(request_data);

      expect(response.status).toBe(401);
    }
  });
});