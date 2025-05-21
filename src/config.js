const mongoose = require('mongoose');

const connect = mongoose.connect("mongodb://0.0.0.0:27017/BlueMoonApartment");

connect.then(() => {
    console.log("Database Connected Successfully");
    // Initialize default data
    createDefaultAdmin();
})
.catch((err) => {
    console.log("Database cannot be Connected:", err.message);
});
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
    position: {
        type: String,
        default: 'Quản lý'
    },
    role: {
        type: String,
        enum: ['admin'], 
        default: 'admin'
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
        type: Number,  // in square meters
        required: true
    },
    isOccupied: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['Đã bàn giao', 'Chưa bàn giao', 'Đang sửa chữa'],
        default: 'Chưa bàn giao'
    },
    handoverDate: {
        type: Date
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
    fullName: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ['Nam', 'Nữ', 'Khác']
    },
    phone: {
        type: String
    },
    email: {
        type: String
    },
    birthdate: {
        type: Date
    },
    idNumber: {
        type: String
    },
    residentType: {
        type: String,
        enum: ['Chủ sở hữu', 'Thành viên gia đình', 'Người thuê'],
        default: 'Chủ sở hữu'
    },
    moveInDate: {
        type: Date,
        default: Date.now
    },
    leaseEndDate: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    familyMembers: [{
        name: String,
        relationship: String,
        age: Number
    }],
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Resident Profile Schema (New)
const ResidentProfileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    apartment: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: String
    },
    phone: {
        type: String
    },
    email: {
        type: String
    },
    idNumber: {
        type: String
    },
    moveInDate: {
        type: String,
        default: "01/01/2023"
    },
    updatedAt: {
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
    scheduledDate: {
        type: Date
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

// Khoản Thu Schema
const KhoanThuSchema = new mongoose.Schema({
    maKhoanThu: {
        type: String,
        required: true,
        unique: true
    },
    tenKhoanThu: {
        type: String,
        required: true
    },
    soTien: {
        type: Number,
        required: true
    },
    loaiKhoanThu: {
        type: Number,
        enum: [0, 1], // 0: Bắt buộc, 1: Đóng góp tự nguyện
        default: 0
    },
    ngayTao: {
        type: Date,
        default: Date.now
    },
    hanThanhToan: {
        type: Date
    },
    moTa: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    }
});

// Nộp Tiền Schema
const NopTienSchema = new mongoose.Schema({
    khoanThu: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'khoanthus',
        required: true
    },
    tenNguoiNop: {
        type: String,
        required: true
    },
    ngayNop: {
        type: Date,
        default: Date.now,
        required: true
    },
    soTien: {
        type: Number,
        required: true
    },
    phuongThucThanhToan: {
        type: String,
        enum: ['cash', 'bank', 'qr'],
        default: 'cash'
    },
    nguoiThu: {
        type: String,
        required: true
    },
    canHo: {
        type: String
    },
    trangThai: {
        type: String,
        enum: ['on-time', 'late', 'partial'],
        default: 'on-time'
    },
    ghiChu: {
        type: String
    }
});

// HoKhau Schema (Household)
const HoKhauSchema = new mongoose.Schema({
    soHoKhau: {
        type: String,
        required: true,
        unique: true
    },
    hoTenChuHo: {
        type: String,
        required: true
    },
    diaChi: {
        type: String,
        required: true
    },
    khuVuc: {
        type: String
    },
    ngayLamHoKhau: {
        type: Date,
        default: Date.now
    },
    ghiChu: {
        type: String
    }
});

// NhanKhau Schema (Resident)
const NhanKhauSchema = new mongoose.Schema({
    hoTen: {
        type: String,
        required: true
    },
    biDanh: {
        type: String
    },
    ngaySinh: {
        type: Date,
        required: true
    },
    gioiTinh: {
        type: String,
        enum: ['Nam', 'Nữ'],
        required: true
    },
    noiSinh: {
        type: String
    },
    nguyenQuan: {
        type: String
    },
    danToc: {
        type: String,
        default: 'Kinh'
    },
    tonGiao: {
        type: String,
        default: 'Không'
    },
    ngheNghiep: {
        type: String
    },
    noiLamViec: {
        type: String
    },
    cccd: {
        type: String
    },
    ngayCap: {
        type: Date
    },
    noiCap: {
        type: String
    },
    hoKhau: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hokhau',
        required: true
    },
    quanHeVoiChuHo: {
        type: String
    },
    ngayDangKyThuongTru: {
        type: Date
    },
    diaChiTruoc: {
        type: String
    },
    ghiChu: {
        type: String
    }
});

// TamTru Schema (Temporary Residence)
const TamTruSchema = new mongoose.Schema({
    nhanKhau: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'nhankhau',
        required: true
    },
    diaChiTamTru: {
        type: String,
        required: true
    },
    tuNgay: {
        type: Date,
        required: true
    },
    denNgay: {
        type: Date,
        required: true
    },
    lyDo: {
        type: String
    },
    trangThai: {
        type: String,
        enum: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'],
        default: 'Chờ duyệt'
    }
});

// TamVang Schema (Temporary Absence)
const TamVangSchema = new mongoose.Schema({
    nhanKhau: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'nhankhau',
        required: true
    },
    noiTamTru: {
        type: String,
        required: true
    },
    tuNgay: {
        type: Date,
        required: true
    },
    denNgay: {
        type: Date,
        required: true
    },
    lyDo: {
        type: String
    },
    trangThai: {
        type: String,
        enum: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'],
        default: 'Chờ duyệt'
    }
});

// BienDoiNhanKhau Schema (Population Changes)
const BienDoiNhanKhauSchema = new mongoose.Schema({
    nhanKhau: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'nhankhau'
    },
    hoKhau: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hokhau'
    },
    loaiThayDoi: {
        type: String,
        enum: ['Thêm mới', 'Xóa', 'Chuyển đi', 'Chuyển đến', 'Tạm trú', 'Tạm vắng'],
        required: true
    },
    ngayThayDoi: {
        type: Date,
        default: Date.now
    },
    noiDung: {
        type: String,
        required: true
    },
    nguoiThucHien: {
        type: String,
        required: true
    }
});

// Maintenance Staff Schema (New)
const MaintenanceStaffSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    position: {
        type: String,
        required: true
    },
    specialization: {
        type: String
    },
    phone: {
        type: String
    },
    email: {
        type: String
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    joinDate: {
        type: Date,
        default: Date.now
    },
    skills: [String],
    notes: String
});
const FeedbackSchema = new mongoose.Schema({
    resident: {
        type: String,
        required: true
    },
    apartment: {
        type: String,
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    response: {
        text: String,
        respondedBy: String,
        respondedAt: Date
    },
    attachments: [String]
});

// Create model from schema
const FeedbackCollection = mongoose.model("feedbacks", FeedbackSchema);
//=============================================================================
// MODEL CREATION
//=============================================================================

// Create models from schemas
const UserCollection = mongoose.model("users", UserSchema);
const ApartmentCollection = mongoose.model("apartments", ApartmentSchema);
const ResidentCollection = mongoose.model("residents", ResidentSchema);
const ResidentProfileCollection = mongoose.model("residentprofiles", ResidentProfileSchema);
const MaintenanceRequestCollection = mongoose.model("maintenanceRequests", MaintenanceRequestSchema);
const PaymentCollection = mongoose.model("payments", PaymentSchema);
const NoticeCollection = mongoose.model("notices", NoticeSchema);
const KhoanThuCollection = mongoose.model("khoanthus", KhoanThuSchema);
const NopTienCollection = mongoose.model("noptiens", NopTienSchema);
const HoKhauCollection = mongoose.model("hokhau", HoKhauSchema);
const NhanKhauCollection = mongoose.model("nhankhau", NhanKhauSchema);
const TamTruCollection = mongoose.model("tamtru", TamTruSchema);
const TamVangCollection = mongoose.model("tamvang", TamVangSchema);
const BienDoiNhanKhauCollection = mongoose.model("biendoinhankhau", BienDoiNhanKhauSchema);
const MaintenanceStaffCollection = mongoose.model("maintenanceStaff", MaintenanceStaffSchema);

//=============================================================================
// INITIALIZATION FUNCTIONS
//=============================================================================

// Function to create default admin account if none exists
async function createDefaultAdmin() {
    try {
        const adminExists = await UserCollection.findOne({ role: 'admin' });
        if (!adminExists) {
            await UserCollection.create({
                name: 'Admin',
                password: '123456789',
                role: 'admin',
                email: 'admin@bluemoonapartment.com',
                phone: '0123456789',
                position: 'Quản lý'
            });
            
            console.log('Default admin account created');
        }

        // Add maintenance staff if none exist
        const staffExists = await UserCollection.countDocuments({ position: { $ne: 'Quản lý' } });
        if (staffExists === 0) {
            const maintenanceStaff = [
                {
                    name: 'Nguyễn Văn A',
                    password: '123456789',
                    role: 'admin',
                    email: 'nguyenvana@bluemoonapartment.com',
                    phone: '0909123456',
                    position: 'Kỹ thuật viên'
                },
                {
                    name: 'Trần Thị B',
                    password: '123456789',
                    role: 'admin',
                    email: 'tranthib@bluemoonapartment.com',
                    phone: '0909234567',
                    position: 'Kỹ thuật viên'
                },
                {
                    name: 'Lê Văn C',
                    password: '123456789',
                    role: 'admin',
                    email: 'levanc@bluemoonapartment.com',
                    phone: '0909345678',
                    position: 'Bảo vệ'
                }
            ];
            
            await UserCollection.insertMany(maintenanceStaff);
            console.log('Maintenance staff accounts created');
        }

        // Create sample data for demo
        await createSampleData();
    } catch (error) {
        console.error('Error creating default admin account:', error);
    }
}

// Function to create sample data for demo
async function createSampleData() {
    try {
        // Create sample apartments if none exist
        const apartmentsExist = await ApartmentCollection.countDocuments();
        if (apartmentsExist === 0) {
            // Create some sample apartments
            const apartments = [];
            for (let block of ['A', 'B']) {
                for (let floor = 1; floor <= 5; floor++) {
                    for (let unit = 1; unit <= 4; unit++) {
                        const apartment = {
                            number: `${block}${floor}${unit.toString().padStart(2, '0')}`,
                            floor,
                            block,
                            type: unit <= 2 ? '2BHK' : '3BHK',
                            area: unit <= 2 ? 75 : 100,
                            isOccupied: Math.random() > 0.2, // 80% occupied
                            status: Math.random() > 0.3 ? 'Đã bàn giao' : 'Chưa bàn giao',
                            handoverDate: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) : null
                        };
                        apartments.push(apartment);
                    }
                }
            }
            await ApartmentCollection.insertMany(apartments);
            console.log('Sample apartments created');
        }

        // Create sample resident profiles if none exist
        const residentProfilesExist = await ResidentProfileCollection.countDocuments();
        if (residentProfilesExist === 0) {
            // Create some sample resident profiles
            const residentProfiles = [
                {
                    userId: "R001",
                    name: "Nguyễn Văn Cư Dân",
                    apartment: "A101",
                    dateOfBirth: "15/05/1985",
                    phone: "0912345678",
                    email: "nguyen.van.cudan@gmail.com",
                    idNumber: "001234567890",
                    moveInDate: "01/01/2023"
                },
                {
                    userId: "R002",
                    name: "Trần Thị Cư Dân",
                    apartment: "B205",
                    dateOfBirth: "20/10/1990",
                    phone: "0923456789",
                    email: "tran.thi.cudan@gmail.com",
                    idNumber: "001345678901",
                    moveInDate: "15/02/2023"
                }
            ];
            
            await ResidentProfileCollection.insertMany(residentProfiles);
            console.log('Sample resident profiles created');
        }

        // Create sample maintenance requests if none exist
        const maintenanceExist = await MaintenanceRequestCollection.countDocuments();
        if (maintenanceExist === 0) {
            // Get admin user and apartments
            const admin = await UserCollection.findOne({ role: 'admin' });
            const apartments = await ApartmentCollection.find().limit(10);
            
            if (admin && apartments.length > 0) {
                // Sample maintenance titles and descriptions
                const maintenanceTitles = [
                    "Sửa chữa đường ống nước",
                    "Thay thế bóng đèn",
                    "Sửa chữa điều hòa",
                    "Bảo trì thang máy",
                    "Sửa chữa cửa ra vào",
                    "Thay thế vòi nước",
                    "Sửa chữa hệ thống điện",
                    "Bảo trì thiết bị phòng tắm",
                    "Sửa chữa rò rỉ nước",
                    "Thay thế ổ khóa"
                ];
                
                const maintenanceDescriptions = [
                    "Đường ống nước trong phòng tắm bị rò rỉ, gây ngập nước và ảnh hưởng đến căn hộ tầng dưới.",
                    "Các bóng đèn trong phòng khách và phòng ngủ đã hết tuổi thọ và cần được thay thế.",
                    "Điều hòa không hoạt động bình thường, không làm mát hoặc phát ra tiếng ồn lớn.",
                    "Thang máy cần được bảo trì định kỳ để đảm bảo an toàn cho cư dân.",
                    "Cửa ra vào bị kẹt, khó đóng mở và phát ra tiếng ồn khi sử dụng.",
                    "Vòi nước trong nhà bếp bị rò rỉ và cần được thay thế.",
                    "Hệ thống điện trong căn hộ có dấu hiệu không ổn định, đèn nhấp nháy.",
                    "Các thiết bị trong phòng tắm cần được bảo trì, bao gồm vòi sen và bồn rửa.",
                    "Phát hiện rò rỉ nước từ trần nhà, có thể do đường ống nước tầng trên bị hỏng.",
                    "Ổ khóa cửa chính bị hỏng, không thể khóa hoặc mở bình thường."
                ];
                
                const priorities = ['low', 'medium', 'high', 'emergency'];
                const statuses = ['pending', 'in-progress', 'completed', 'cancelled'];
                
                // Generate 10 random maintenance requests
                const maintenanceRequests = [];
                
                for (let i = 0; i < 10; i++) {
                    // Select a random apartment
                    const randomApartment = apartments[Math.floor(Math.random() * apartments.length)];
                    
                    // Generate random dates
                    const today = new Date();
                    const pastDate = new Date(today);
                    pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
                    
                    const futureDate = new Date(today);
                    futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 14)); // Random date in next 14 days
                    
                    // Select random title and description
                    const randomIndex = Math.floor(Math.random() * maintenanceTitles.length);
                    const title = maintenanceTitles[randomIndex];
                    const description = maintenanceDescriptions[randomIndex];
                    
                    // Select random priority and status
                    const priority = priorities[Math.floor(Math.random() * priorities.length)];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    
                    // Create maintenance request object
                    const request = {
                        apartment: randomApartment._id,
                        requestedBy: admin._id,
                        title,
                        description,
                        priority,
                        status,
                        createdAt: pastDate,
                        assignedTo: status !== 'pending' ? admin._id : null,
                        scheduledDate: status !== 'pending' ? futureDate : null,
                        completedAt: status === 'completed' ? today : null,
                        notes: [
                            {
                                text: `Yêu cầu bảo trì được tạo bởi ${admin.name}`,
                                addedBy: admin._id,
                                addedAt: pastDate
                            }
                        ]
                    };
                    
                    maintenanceRequests.push(request);
                }
                
                await MaintenanceRequestCollection.insertMany(maintenanceRequests);
                console.log('Sample maintenance requests created');
            }
        }

        // Create sample khoản thu if none exist
        const khoanThuExist = await KhoanThuCollection.countDocuments();
        if (khoanThuExist === 0) {
            // Create some sample khoản thu
            const khoanThuList = [
                {
                    maKhoanThu: "PVS2023",
                    tenKhoanThu: "Phí vệ sinh 2023",
                    soTien: 200000,
                    loaiKhoanThu: 0,
                    ngayTao: new Date('2023-01-01'),
                    hanThanhToan: new Date('2023-01-31')
                },
                {
                    maKhoanThu: "PDV2023",
                    tenKhoanThu: "Phí dịch vụ Q1/2023",
                    soTien: 500000,
                    loaiKhoanThu: 0,
                    ngayTao: new Date('2023-01-15'),
                    hanThanhToan: new Date('2023-02-15')
                },
                {
                    maKhoanThu: "QNM2023",
                    tenKhoanThu: "Quỹ người nghèo 2023",
                    soTien: 100000,
                    loaiKhoanThu: 1,
                    ngayTao: new Date('2023-02-01'),
                    hanThanhToan: new Date('2023-03-01')
                }
            ];
            await KhoanThuCollection.insertMany(khoanThuList);
            console.log('Sample khoan thu created');
        }

        // Create sample nộp tiền if none exist
        const nopTienExist = await NopTienCollection.countDocuments();
        if (nopTienExist === 0 && khoanThuExist > 0) {
            // Get the khoản thu list
            const khoanThuList = await KhoanThuCollection.find();
            
            // Get some apartments for sample payments
            const apartments = await ApartmentCollection.find().limit(20);
            
            // Create sample payments
            const nopTienList = [];
            for (let apt of apartments) {
                for (let khoanThu of khoanThuList) {
                    // 80% chance of paying
                    if (Math.random() > 0.2) {
                        // 70% chance of paying on time
                        const isOnTime = Math.random() > 0.3;
                        const paymentDate = isOnTime 
                            ? new Date(khoanThu.ngayTao.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000) // 0-10 days after creation
                            : new Date(khoanThu.hanThanhToan.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000); // 0-10 days after due date
                        
                        nopTienList.push({
                            khoanThu: khoanThu._id,
                            tenNguoiNop: `Chủ hộ căn ${apt.number}`,
                            ngayNop: paymentDate,
                            soTien: khoanThu.soTien,
                            phuongThucThanhToan: ['cash', 'bank', 'qr'][Math.floor(Math.random() * 3)],
                            nguoiThu: 'admin',
                            canHo: apt.number,
                            trangThai: isOnTime ? 'on-time' : 'late'
                        });
                    }
                }
            }
            
            if (nopTienList.length > 0) {
                await NopTienCollection.insertMany(nopTienList);
                console.log('Sample nop tien created');
            }
        }
    } catch (error) {
        console.error('Error creating sample data:', error);
    }
}

// Export models for use in other files
module.exports = { 
    UserCollection, 
    ApartmentCollection, 
    ResidentCollection, 
    ResidentProfileCollection,
    PaymentCollection,
    NoticeCollection,
    KhoanThuCollection,
    NopTienCollection,
    HoKhauCollection,
    NhanKhauCollection,
    TamTruCollection,
    TamVangCollection,
    BienDoiNhanKhauCollection,
    FeedbackCollection,
    MaintenanceStaffCollection
};