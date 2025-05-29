// tests/routes/feedback.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');

describe('Feedback Management Routes', () => {
  let app;
  let testConnection;
  let FeedbackCollection;
  let cudanAgent;
  let toquanAgent;

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
    
    const FeedbackSchema = new mongoose.Schema({
      resident: { type: String, required: true },
      apartment: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, required: true },
      category: {
        type: String,
        enum: ['maintenance', 'security', 'neighbor', 'facilities', 'payment', 'other'],
        default: 'other'
      },
      status: {
        type: String,
        enum: ['pending', 'in-progress', 'resolved', 'rejected'],
        default: 'pending'
      },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      response: {
        text: String,
        respondedBy: String,
        respondedAt: Date
      },
      attachments: [String]
    });

    FeedbackCollection = testConnection.model('feedbacks', FeedbackSchema);

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

    const ensureToQuan = (req, res, next) => {
      if (req.session.role === 'toquan') {
        return next();
      }
      res.status(403).json({ error: 'Team Leader privileges required' });
    };

    // Login routes
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

    app.post('/toquan/login', (req, res) => {
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

    // Feedback routes
    app.get('/cudan/feedback', ensureAuthenticated, ensureCuDan, async (req, res) => {
      try {
        const residentName = req.session.name;
        const apartment = "A0101";
        
        const feedbackList = await FeedbackCollection.find({ 
          resident: residentName
        }).sort({ createdAt: -1 });
        
        res.json({ feedbackList, residentName, apartment });
      } catch (error) {
        res.status(500).json({ error: 'Error loading feedback form: ' + error.message });
      }
    });

    app.post('/cudan/feedback/submit', ensureAuthenticated, ensureCuDan, async (req, res) => {
      try {
        const { title, category, description } = req.body;
        
        if (!title || !category || !description) {
          return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }
        
        const residentName = req.session.name;
        const apartment = "A0101";
        
        const newFeedback = new FeedbackCollection({
          resident: residentName,
          apartment,
          title,
          description,
          category,
          status: 'pending'
        });
        
        await newFeedback.save();
        
        res.status(201).json({ 
          success: true, 
          message: 'Phản ánh của bạn đã được gửi thành công',
          data: newFeedback
        });
      } catch (error) {
        res.status(500).json({ error: 'Error submitting feedback: ' + error.message });
      }
    });

    app.get('/toquan/bao-cao', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        
        const pendingCount = await FeedbackCollection.countDocuments({ status: 'pending' });
        const inProgressCount = await FeedbackCollection.countDocuments({ status: 'in-progress' });
        const resolvedCount = await FeedbackCollection.countDocuments({ status: 'resolved' });
        const rejectedCount = await FeedbackCollection.countDocuments({ status: 'rejected' });
        
        const totalCount = await FeedbackCollection.countDocuments();
        const totalPages = Math.ceil(totalCount / limit);
        
        const feedbackList = await FeedbackCollection.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);
        
        res.json({
          feedbackList,
          pendingCount,
          inProgressCount,
          resolvedCount,
          rejectedCount,
          currentPage: page,
          totalPages
        });
      } catch (error) {
        res.status(500).json({ error: 'Error loading feedback management: ' + error.message });
      }
    });

    app.post('/toquan/bao-cao/respond', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const { feedbackId, status, responseText } = req.body;
        
        if (!feedbackId || !status) {
          return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
        }
        
        const feedback = await FeedbackCollection.findById(feedbackId);
        
        if (!feedback) {
          return res.status(404).json({ error: 'Phản ánh không tồn tại' });
        }
        
        feedback.status = status;
        
        if (responseText && responseText.trim() !== '') {
          feedback.response = {
            text: responseText,
            respondedBy: req.session.name,
            respondedAt: new Date()
          };
        }
        
        feedback.updatedAt = new Date();
        
        await feedback.save();
        
        res.json({ 
          success: true, 
          message: 'Phản hồi đã được gửi thành công',
          data: feedback
        });
      } catch (error) {
        res.status(500).json({ error: 'Error responding to feedback: ' + error.message });
      }
    });

    app.post('/toquan/bao-cao/:id/update-status', ensureAuthenticated, ensureToQuan, async (req, res) => {
      try {
        const { status } = req.body;
        const feedbackId = req.params.id;
        
        if (!status) {
          return res.status(400).json({ error: 'Trạng thái không được để trống' });
        }
        
        const feedback = await FeedbackCollection.findById(feedbackId);
        
        if (!feedback) {
          return res.status(404).json({ error: 'Phản ánh không tồn tại' });
        }
        
        const oldStatus = feedback.status;
        feedback.status = status;
        feedback.updatedAt = new Date();
        
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
        
        res.json({ 
          success: true, 
          message: 'Cập nhật trạng thái thành công',
          oldStatus,
          newStatus: status,
          data: feedback
        });
      } catch (error) {
        res.status(500).json({ error: 'Error updating feedback status: ' + error.message });
      }
    });

    app.get('/api/feedback', ensureAuthenticated, async (req, res) => {
      try {
        const feedbackList = await FeedbackCollection.find().sort({ createdAt: -1 });
        res.json(feedbackList);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching feedback' });
      }
    });

    app.get('/api/feedback/:id', ensureAuthenticated, async (req, res) => {
      try {
        const feedback = await FeedbackCollection.findById(req.params.id);
        if (!feedback) {
          return res.status(404).json({ error: 'Feedback không tồn tại' });
        }
        res.json(feedback);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching feedback details' });
      }
    });

    // Tạo agents để maintain sessions
    cudanAgent = request.agent(app);
    toquanAgent = request.agent(app);
  });

  beforeEach(async () => {
    // Clear database và login trước mỗi test
    if (FeedbackCollection) {
      await FeedbackCollection.deleteMany({});
    }
    
    // Login as cudan và toquan
    await cudanAgent
      .post('/cudan/login')
      .send({ username: 'cudan1', password: '123456789' });

    await toquanAgent
      .post('/toquan/login')
      .send({ username: 'totruong', password: '123456789' });
  });

  // TEST 1: Resident successfully submits feedback
  test('Resident should successfully submit feedback', async () => {
    const feedbackData = global.testHelpers.createMockFeedback({
      title: 'Vấn đề điện nước',
      description: 'Mất điện thường xuyên tại căn hộ A101',
      category: 'maintenance'
    });

    const response = await cudanAgent
      .post('/cudan/feedback/submit')
      .send(feedbackData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Vấn đề điện nước');
    expect(response.body.data.category).toBe('maintenance');
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.resident).toBe('cudan');
  });

  // TEST 2: Fail to submit feedback without required fields
  test('Should fail to submit feedback without required fields', async () => {
    const incompleteData = {
      title: 'Test title'
      // Missing category and description
    };

    const response = await cudanAgent
      .post('/cudan/feedback/submit')
      .send(incompleteData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Vui lòng điền đầy đủ thông tin bắt buộc');
  });

  // TEST 3: Get resident's feedback list
  test('Should retrieve resident feedback list', async () => {
    // Create some test feedback
    await FeedbackCollection.create([
      global.testHelpers.createMockFeedback({
        resident: 'cudan',
        title: 'Feedback 1'
      }),
      global.testHelpers.createMockFeedback({
        resident: 'cudan',
        title: 'Feedback 2'
      }),
      global.testHelpers.createMockFeedback({
        resident: 'other_user',
        title: 'Other feedback'
      })
    ]);

    const response = await cudanAgent.get('/cudan/feedback');

    expect(response.status).toBe(200);
    expect(response.body.feedbackList).toHaveLength(2);
    expect(response.body.feedbackList.every(f => f.resident === 'cudan')).toBe(true);
  });

  // TEST 4: Manager views all feedback
  test('Manager should view all feedback with statistics', async () => {
    // Create test feedback with different statuses
    await FeedbackCollection.create([
      global.testHelpers.createMockFeedback({ status: 'pending' }),
      global.testHelpers.createMockFeedback({ status: 'pending' }),
      global.testHelpers.createMockFeedback({ status: 'in-progress' }),
      global.testHelpers.createMockFeedback({ status: 'resolved' }),
      global.testHelpers.createMockFeedback({ status: 'rejected' })
    ]);

    const response = await toquanAgent.get('/toquan/bao-cao');

    expect(response.status).toBe(200);
    expect(response.body.feedbackList).toHaveLength(5);
    expect(response.body.pendingCount).toBe(2);
    expect(response.body.inProgressCount).toBe(1);
    expect(response.body.resolvedCount).toBe(1);
    expect(response.body.rejectedCount).toBe(1);
  });

  // TEST 5: Manager responds to feedback
  test('Manager should successfully respond to feedback', async () => {
    const feedback = await FeedbackCollection.create(
      global.testHelpers.createMockFeedback({
        title: 'Test feedback',
        status: 'pending'
      })
    );

    const responseData = {
      feedbackId: feedback._id.toString(),
      status: 'in-progress',
      responseText: 'Chúng tôi đang xử lý vấn đề của bạn'
    };

    const response = await toquanAgent
      .post('/toquan/bao-cao/respond')
      .send(responseData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('in-progress');
    expect(response.body.data.response.text).toBe('Chúng tôi đang xử lý vấn đề của bạn');
    expect(response.body.data.response.respondedBy).toBe('toquan');
  });

  // TEST 6: Update feedback status quickly
  test('Should quickly update feedback status', async () => {
    const feedback = await FeedbackCollection.create(
      global.testHelpers.createMockFeedback({ status: 'pending' })
    );

    const response = await toquanAgent
      .post(`/toquan/bao-cao/${feedback._id}/update-status`)
      .send({ status: 'resolved' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.oldStatus).toBe('pending');
    expect(response.body.newStatus).toBe('resolved');
    expect(response.body.data.status).toBe('resolved');
  });

  // TEST 7: Validate feedback categories
  test('Should accept valid feedback categories', async () => {
    const validCategories = ['maintenance', 'security', 'neighbor', 'facilities', 'payment', 'other'];

    for (let i = 0; i < validCategories.length; i++) {
      const feedbackData = global.testHelpers.createMockFeedback({
        title: `Feedback ${i}`,
        category: validCategories[i]
      });

      const response = await cudanAgent
        .post('/cudan/feedback/submit')
        .send(feedbackData);

      expect(response.status).toBe(201);
      expect(response.body.data.category).toBe(validCategories[i]);

      // Clean up for next iteration
      await FeedbackCollection.findByIdAndDelete(response.body.data._id);
    }
  });

  // TEST 8: Validate feedback status values
  test('Should handle valid status transitions', async () => {
    const feedback = await FeedbackCollection.create(
      global.testHelpers.createMockFeedback({ status: 'pending' })
    );

    const validStatuses = ['in-progress', 'resolved', 'rejected'];

    for (const status of validStatuses) {
      const response = await toquanAgent
        .post(`/toquan/bao-cao/${feedback._id}/update-status`)
        .send({ status });

      expect(response.status).toBe(200);
      expect(response.body.newStatus).toBe(status);
    }
  });

  // TEST 9: Handle non-existent feedback
  test('Should handle operations on non-existent feedback', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const response = await toquanAgent
      .post(`/toquan/bao-cao/${fakeId}/update-status`)
      .send({ status: 'resolved' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Phản ánh không tồn tại');
  });

  // TEST 10: Get specific feedback details
  test('Should retrieve specific feedback details', async () => {
    const feedback = await FeedbackCollection.create(
      global.testHelpers.createMockFeedback({
        title: 'Specific feedback',
        description: 'Detailed description'
      })
    );

    const response = await cudanAgent.get(`/api/feedback/${feedback._id}`);

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(feedback._id.toString());
    expect(response.body.title).toBe('Specific feedback');
    expect(response.body.description).toBe('Detailed description');
  });

  // TEST 11: Pagination functionality
  test('Should handle pagination for feedback list', async () => {
    // Create 15 feedback items
    const feedbackItems = [];
    for (let i = 0; i < 15; i++) {
      feedbackItems.push(global.testHelpers.createMockFeedback({
        title: `Feedback ${i}`,
        resident: 'test_user'
      }));
    }
    await FeedbackCollection.create(feedbackItems);

    // Test first page
    const page1Response = await toquanAgent.get('/toquan/bao-cao?page=1');
    expect(page1Response.status).toBe(200);
    expect(page1Response.body.feedbackList).toHaveLength(12); // limit is 12
    expect(page1Response.body.currentPage).toBe(1);
    expect(page1Response.body.totalPages).toBe(2);

    // Test second page
    const page2Response = await toquanAgent.get('/toquan/bao-cao?page=2');
    expect(page2Response.status).toBe(200);
    expect(page2Response.body.feedbackList).toHaveLength(3); // remaining 3 items
    expect(page2Response.body.currentPage).toBe(2);
  });

  // TEST 12: Authorization requirements
  test('Should require authentication for feedback operations', async () => {
    const newAgent = request.agent(app);
    
    const response = await newAgent
      .post('/cudan/feedback/submit')
      .send(global.testHelpers.createMockFeedback());

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  // TEST 13: Role-based access control
  test('Should enforce role-based access for management functions', async () => {
    const feedback = await FeedbackCollection.create(
      global.testHelpers.createMockFeedback()
    );

    // Resident trying to access management function
    const response = await cudanAgent
      .post('/toquan/bao-cao/respond')
      .send({
        feedbackId: feedback._id.toString(),
        status: 'resolved',
        responseText: 'Test response'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Team Leader privileges required');
  });

  // TEST 14: Auto-response for status updates
  test('Should automatically generate response for status updates', async () => {
    const feedback = await FeedbackCollection.create(
      global.testHelpers.createMockFeedback({ status: 'pending' })
    );

    const response = await toquanAgent
      .post(`/toquan/bao-cao/${feedback._id}/update-status`)
      .send({ status: 'resolved' });

    expect(response.status).toBe(200);
    expect(response.body.data.response.text).toBe('Phản ánh của bạn đã được giải quyết.');
    expect(response.body.data.response.respondedBy).toBe('toquan');
    expect(response.body.data.response.respondedAt).toBeDefined();
  });

  // TEST 15: Feedback timestamps
  test('Should properly track feedback timestamps', async () => {
    const beforeSubmit = new Date();
    
    const feedbackData = global.testHelpers.createMockFeedback({
      title: 'Timestamp test'
    });

    const submitResponse = await cudanAgent
      .post('/cudan/feedback/submit')
      .send(feedbackData);

    const afterSubmit = new Date();

    expect(submitResponse.status).toBe(201);
    
    const createdAt = new Date(submitResponse.body.data.createdAt);
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeSubmit.getTime());
    expect(createdAt.getTime()).toBeLessThanOrEqual(afterSubmit.getTime());

    // Test update timestamp
    const beforeUpdate = new Date();
    
    const updateResponse = await toquanAgent
      .post(`/toquan/bao-cao/${submitResponse.body.data._id}/update-status`)
      .send({ status: 'in-progress' });

    const afterUpdate = new Date();
    
    const updatedAt = new Date(updateResponse.body.data.updatedAt);
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    expect(updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
  });
});