const mongoose = require('mongoose');
const connect = mongoose.connect("mongodb://0.0.0.0:27017/BlueMoonApartment");

connect.then(() => {
    console.log("Database Connected Successfully");
    // Ensure admin account exists
    createDefaultAdmin();
})
.catch(() => {
    console.log("Database cannot be Connected");
});

// User Schema - Admin role for apartment management
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

// Khoản Thu Schema (Mới)
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

// Nộp Tiền Schema (Mới)
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

// HoKhau Schema (Household) - Moved to module level
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
    ngayLamHoKhau: {
        type: Date,
        default: Date.now
    },
    ghiChu: {
        type: String
    }
});

// NhanKhau Schema (Resident) - Moved to module level
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
        type: String
    },
    tonGiao: {
        type: String
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

// TamTru Schema (Temporary Residence) - Moved to module level
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

// TamVang Schema (Temporary Absence) - Moved to module level
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

// BienDoiNhanKhau Schema (Population Changes) - Moved to module level
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

// Create models from schemas - All at module level
const UserCollection = mongoose.model("users", UserSchema);
const ApartmentCollection = mongoose.model("apartments", ApartmentSchema);
const ResidentCollection = mongoose.model("residents", ResidentSchema);
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

// Function to create default admin account if none exists
async function createDefaultAdmin() {
    try {
        const adminExists = await UserCollection.findOne({ role: 'admin' });
        if (!adminExists) {
            await UserCollection.create({
                name: 'admin',
                password: '123456789',
                role: 'admin',
                email: 'admin@apartmentmanagement.com'
            });
            
            console.log('Default admin account created');
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
                            isOccupied: Math.random() > 0.2 // 80% occupied
                        };
                        apartments.push(apartment);
                    }
                }
            }
            await ApartmentCollection.insertMany(apartments);
            console.log('Sample apartments created');
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


// Export models - All models defined above can now be exported
module.exports = { 
    UserCollection, 
    ApartmentCollection, 
    ResidentCollection, 
    MaintenanceRequestCollection, 
    PaymentCollection,
    NoticeCollection,
    KhoanThuCollection,
    NopTienCollection,
    HoKhauCollection,
    NhanKhauCollection,
    TamTruCollection,
    TamVangCollection,
    BienDoiNhanKhauCollection
};