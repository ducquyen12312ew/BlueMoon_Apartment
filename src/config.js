const mongoose = require('mongoose');
const connect = mongoose.connect("mongodb://0.0.0.0:27017/ApartmentManagement");

connect.then(() => {
    console.log("Database Connected Successfully");
})
.catch(() => {
    console.log("Database cannot be Connected");
});

// User Schema - Different roles for apartment management
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String
    },
    phone: {
        type: String
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'security', 'resident'], 
        default: 'resident'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Apartment Schema
const ApartmentSchema = new mongoose.Schema({
    number: {
        type: String,
        required: true,
        unique: true
    },
    floor: {
        type: Number,
        required: true
    },
    block: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['studio', '1BHK', '2BHK', '3BHK', 'penthouse'],
        required: true
    },
    area: {
        type: Number,  // in square feet
        required: true
    },
    isOccupied: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Resident Schema
const ResidentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    apartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'apartments',
        required: true
    },
    moveInDate: {
        type: Date,
        default: Date.now
    },
    leaseEndDate: {
        type: Date
    },
    isOwner: {
        type: Boolean,
        default: false
    },
    familyMembers: [{
        name: String,
        relationship: String,
        age: Number
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Maintenance Request Schema
const MaintenanceRequestSchema = new mongoose.Schema({
    apartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'apartments',
        required: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'emergency'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    notes: [{
        text: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
});

// Payment Schema
const PaymentSchema = new mongoose.Schema({
    apartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'apartments',
        required: true
    },
    resident: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'residents',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['rent', 'maintenance', 'utility', 'other'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'overdue'],
        default: 'pending'
    },
    dueDate: {
        type: Date,
        required: true
    },
    paidDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank transfer', 'card', 'online', 'check'],
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Notice Schema
const NoticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    postedAt: {
        type: Date,
        default: Date.now
    },
    isImportant: {
        type: Boolean,
        default: false
    },
    expiry: {
        type: Date
    }
});

// Create models from schemas
const UserCollection = mongoose.model("users", UserSchema);
const ApartmentCollection = mongoose.model("apartments", ApartmentSchema);
const ResidentCollection = mongoose.model("residents", ResidentSchema);
const MaintenanceRequestCollection = mongoose.model("maintenanceRequests", MaintenanceRequestSchema);
const PaymentCollection = mongoose.model("payments", PaymentSchema);
const NoticeCollection = mongoose.model("notices", NoticeSchema);

// Export models
module.exports = { 
    UserCollection, 
    ApartmentCollection, 
    ResidentCollection, 
    MaintenanceRequestCollection, 
    PaymentCollection,
    NoticeCollection
};