// generate-residents.js
const mongoose = require('mongoose');
const { HoKhauCollection, NhanKhauCollection, BienDoiNhanKhauCollection } = require('./config');

async function generateResidents() {
    try {
        // Connect to database
        await mongoose.connect("mongodb://0.0.0.0:27017/BlueMoonApartment");
        console.log("Connected to database");

        // Fetch all households
        const households = await HoKhauCollection.find();
        console.log(`Found ${households.length} households to populate with members`);

        if (households.length === 0) {
            console.log("No households found. Please generate households first.");
            await mongoose.disconnect();
            return;
        }

        // Check if residents already exist
        const existingResidentsCount = await NhanKhauCollection.countDocuments();
        if (existingResidentsCount > 0) {
            console.log(`Warning: ${existingResidentsCount} residents already exist. This script may create duplicates.`);
        }

        // Vietnamese names
        const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
        const middleNames = ['Văn', 'Thị', 'Hữu', 'Đức', 'Quang', 'Minh', 'Hoàng', 'Thanh', 'Thành', 'Đình', 'Công', 'Anh', 'Thu', 'Thúy', 'Tuấn'];
        const maleNames = ['An', 'Bình', 'Cường', 'Dũng', 'Hùng', 'Hải', 'Nam', 'Phong', 'Quân', 'Thắng', 'Tú', 'Việt'];
        const femaleNames = ['Anh', 'Bích', 'Chi', 'Giang', 'Hà', 'Hương', 'Linh', 'Mai', 'Ngọc', 'Phương', 'Thảo', 'Yến'];
        
        // Relationships
        const relationships = [
            { name: "Chủ hộ", gender: "any" },
            { name: "Vợ", gender: "female" },
            { name: "Chồng", gender: "male" },
            { name: "Con trai", gender: "male" },
            { name: "Con gái", gender: "female" },
            { name: "Bố", gender: "male" },
            { name: "Mẹ", gender: "female" },
            { name: "Ông", gender: "male" },
            { name: "Bà", gender: "female" }
        ];

        // Employment data
        const occupations = ['Giáo viên', 'Kỹ sư', 'Bác sĩ', 'Công nhân', 'Kinh doanh', 'Công chức', 'Sinh viên', 'Kế toán', 'Nội trợ', 'Nghỉ hưu'];
        const workplaces = ['Trường học', 'Công ty công nghệ', 'Bệnh viện', 'Nhà máy', 'Cửa hàng', 'Cơ quan nhà nước', 'Trường đại học', 'Ngân hàng', 'Tại nhà', ''];

        // Array to hold all new residents
        const allResidents = [];
        const allChangeRecords = [];

        // For each household, create 3-4 residents
        for (const household of households) {
            // Get household head name
            const headName = household.hoTenChuHo;
            
            // Random number of residents (3-4)
            const residentCount = Math.floor(Math.random() * 2) + 3; // 3-4
            const residents = [];
            
            // First resident is the household head
            const headParts = headName.split(' ');
            const headSurname = headParts[0];
            const headGender = Math.random() > 0.5 ? 'Nam' : 'Nữ';
            
            // Generate birth date for head (30-60 years old)
            const headAge = Math.floor(Math.random() * 30) + 30; // 30-60
            const headBirthDate = new Date();
            headBirthDate.setFullYear(headBirthDate.getFullYear() - headAge);
            
            // ID card details
            const cccdHead = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
            const ngayCapHead = new Date();
            ngayCapHead.setFullYear(ngayCapHead.getFullYear() - Math.floor(Math.random() * 10)); // 0-10 years ago
            
            // Create head resident
            residents.push({
                hoTen: headName,
                biDanh: '',
                ngaySinh: headBirthDate,
                gioiTinh: headGender,
                noiSinh: 'Hà Nội',
                nguyenQuan: 'Hà Nội',
                danToc: 'Kinh',
                tonGiao: 'Không',
                ngheNghiep: occupations[Math.floor(Math.random() * occupations.length)],
                noiLamViec: workplaces[Math.floor(Math.random() * workplaces.length)],
                cccd: cccdHead,
                ngayCap: ngayCapHead,
                noiCap: 'Cục CSQLHC về TTXH',
                hoKhau: household._id,
                quanHeVoiChuHo: 'Chủ hộ',
                ngayDangKyThuongTru: household.ngayLamHoKhau,
                diaChiTruoc: '',
                ghiChu: 'Tự động tạo'
            });
            
            // Create spouse if applicable (for heads aged 22+)
            if (headAge >= 22 && residents.length < residentCount) {
                const spouseGender = headGender === 'Nam' ? 'Nữ' : 'Nam';
                const spouseRelationship = headGender === 'Nam' ? 'Vợ' : 'Chồng';
                
                // Generate spouse name
                const spouseSurname = surnames[Math.floor(Math.random() * surnames.length)];
                const spouseMiddleName = spouseGender === 'Nữ' ? 'Thị' : 'Văn';
                const spouseName = spouseGender === 'Nữ' 
                    ? femaleNames[Math.floor(Math.random() * femaleNames.length)]
                    : maleNames[Math.floor(Math.random() * maleNames.length)];
                
                const spouseFullName = `${spouseSurname} ${spouseMiddleName} ${spouseName}`;
                
                // Generate birth date (within 5 years of head)
                const spouseAge = headAge + Math.floor(Math.random() * 10) - 5;
                const spouseBirthDate = new Date();
                spouseBirthDate.setFullYear(spouseBirthDate.getFullYear() - spouseAge);
                
                // ID card details
                const cccdSpouse = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
                const ngayCapSpouse = new Date();
                ngayCapSpouse.setFullYear(ngayCapSpouse.getFullYear() - Math.floor(Math.random() * 10));
                
                residents.push({
                    hoTen: spouseFullName,
                    biDanh: '',
                    ngaySinh: spouseBirthDate,
                    gioiTinh: spouseGender,
                    noiSinh: 'Hà Nội',
                    nguyenQuan: 'Hà Nội',
                    danToc: 'Kinh',
                    tonGiao: 'Không',
                    ngheNghiep: occupations[Math.floor(Math.random() * occupations.length)],
                    noiLamViec: workplaces[Math.floor(Math.random() * workplaces.length)],
                    cccd: cccdSpouse,
                    ngayCap: ngayCapSpouse,
                    noiCap: 'Cục CSQLHC về TTXH',
                    hoKhau: household._id,
                    quanHeVoiChuHo: spouseRelationship,
                    ngayDangKyThuongTru: household.ngayLamHoKhau,
                    diaChiTruoc: '',
                    ghiChu: 'Tự động tạo'
                });
            }
            
            // Create children if applicable (for heads aged 23+)
            if (headAge >= 23) {
                const hasSpouse = residents.length > 1;
                const maxChildren = residentCount - residents.length;
                
                if (maxChildren > 0) {
                    // Random number of children (up to max allowed)
                    const childrenCount = Math.min(Math.floor(Math.random() * 3) + 1, maxChildren);
                    
                    for (let i = 0; i < childrenCount; i++) {
                        // Child's gender
                        const childGender = Math.random() > 0.5 ? 'Nam' : 'Nữ';
                        const childRelationship = childGender === 'Nam' ? 'Con trai' : 'Con gái';
                        
                        // Child's name
                        const childMiddleName = childGender === 'Nữ' ? 'Thị' : 'Văn';
                        const childName = childGender === 'Nữ'
                            ? femaleNames[Math.floor(Math.random() * femaleNames.length)]
                            : maleNames[Math.floor(Math.random() * maleNames.length)];
                        
                        const childFullName = `${headSurname} ${childMiddleName} ${childName}`;
                        
                        // Child's age based on parents' age
                        const maxChildAge = headAge - 20;
                        const minChildAge = 0;
                        const childAge = Math.floor(Math.random() * (maxChildAge - minChildAge)) + minChildAge;
                        
                        const childBirthDate = new Date();
                        childBirthDate.setFullYear(childBirthDate.getFullYear() - childAge);
                        
                        // ID card for children 14+
                        let cccdChild = '';
                        let ngayCapChild = null;
                        
                        if (childAge >= 14) {
                            cccdChild = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
                            ngayCapChild = new Date();
                            ngayCapChild.setFullYear(ngayCapChild.getFullYear() - Math.floor(Math.random() * 3));
                        }
                        
                        // Occupation based on age
                        let childOccupation = '';
                        let childWorkplace = '';
                        
                        if (childAge < 6) {
                            childOccupation = 'Mầm non';
                            childWorkplace = 'Trường mầm non';
                        } else if (childAge < 11) {
                            childOccupation = 'Học sinh tiểu học';
                            childWorkplace = 'Trường tiểu học';
                        } else if (childAge < 15) {
                            childOccupation = 'Học sinh THCS';
                            childWorkplace = 'Trường THCS';
                        } else if (childAge < 18) {
                            childOccupation = 'Học sinh THPT';
                            childWorkplace = 'Trường THPT';
                        } else if (childAge < 23) {
                            childOccupation = 'Sinh viên';
                            childWorkplace = 'Trường đại học';
                        } else {
                            childOccupation = occupations[Math.floor(Math.random() * occupations.length)];
                            childWorkplace = workplaces[Math.floor(Math.random() * workplaces.length)];
                        }
                        
                        residents.push({
                            hoTen: childFullName,
                            biDanh: '',
                            ngaySinh: childBirthDate,
                            gioiTinh: childGender,
                            noiSinh: 'Hà Nội',
                            nguyenQuan: 'Hà Nội',
                            danToc: 'Kinh',
                            tonGiao: 'Không',
                            ngheNghiep: childOccupation,
                            noiLamViec: childWorkplace,
                            cccd: cccdChild,
                            ngayCap: ngayCapChild,
                            noiCap: cccdChild ? 'Cục CSQLHC về TTXH' : '',
                            hoKhau: household._id,
                            quanHeVoiChuHo: childRelationship,
                            ngayDangKyThuongTru: household.ngayLamHoKhau,
                            diaChiTruoc: '',
                            ghiChu: 'Tự động tạo'
                        });
                    }
                }
            }
            
            // Create grandparents or parents if needed to meet minimum resident count
            while (residents.length < residentCount) {
                // Decide if parent or grandparent
                const isParent = Math.random() > 0.5;
                const parentGender = Math.random() > 0.5 ? 'Nam' : 'Nữ';
                
                const relationship = isParent 
                    ? (parentGender === 'Nam' ? 'Bố' : 'Mẹ')
                    : (parentGender === 'Nam' ? 'Ông' : 'Bà');
                
                // Name
                const elderSurname = isParent ? headSurname : surnames[Math.floor(Math.random() * surnames.length)];
                const elderMiddleName = parentGender === 'Nữ' ? 'Thị' : 'Văn';
                const elderName = parentGender === 'Nữ'
                    ? femaleNames[Math.floor(Math.random() * femaleNames.length)]
                    : maleNames[Math.floor(Math.random() * maleNames.length)];
                
                const elderFullName = `${elderSurname} ${elderMiddleName} ${elderName}`;
                
                // Age
                const elderAge = isParent ? headAge + 25 : headAge + 50;
                const elderBirthDate = new Date();
                elderBirthDate.setFullYear(elderBirthDate.getFullYear() - elderAge);
                
                // ID card details
                const cccdElder = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
                const ngayCapElder = new Date();
                ngayCapElder.setFullYear(ngayCapElder.getFullYear() - Math.floor(Math.random() * 15));
                
                residents.push({
                    hoTen: elderFullName,
                    biDanh: '',
                    ngaySinh: elderBirthDate,
                    gioiTinh: parentGender,
                    noiSinh: 'Hà Nội',
                    nguyenQuan: 'Hà Nội',
                    danToc: 'Kinh',
                    tonGiao: 'Không',
                    ngheNghiep: elderAge > 60 ? 'Nghỉ hưu' : occupations[Math.floor(Math.random() * occupations.length)],
                    noiLamViec: elderAge > 60 ? 'Tại nhà' : workplaces[Math.floor(Math.random() * workplaces.length)],
                    cccd: cccdElder,
                    ngayCap: ngayCapElder,
                    noiCap: 'Cục CSQLHC về TTXH',
                    hoKhau: household._id,
                    quanHeVoiChuHo: relationship,
                    ngayDangKyThuongTru: household.ngayLamHoKhau,
                    diaChiTruoc: '',
                    ghiChu: 'Tự động tạo'
                });
            }
            
            // Add all residents for this household to the collection
            allResidents.push(...residents);
            
            console.log(`Created ${residents.length} members for household ${household.soHoKhau}`);
        }
        
        // Insert all residents into database
        if (allResidents.length > 0) {
            const insertedResidents = await NhanKhauCollection.insertMany(allResidents);
            console.log(`Successfully created ${insertedResidents.length} residents across ${households.length} households.`);
            
            // Create change records for each resident
            for (const resident of insertedResidents) {
                allChangeRecords.push({
                    nhanKhau: resident._id,
                    hoKhau: resident.hoKhau,
                    loaiThayDoi: 'Thêm mới',
                    ngayThayDoi: new Date(),
                    noiDung: `Thêm mới nhân khẩu ${resident.hoTen} vào hộ khẩu`,
                    nguoiThucHien: 'system'
                });
            }
            
            if (allChangeRecords.length > 0) {
                await BienDoiNhanKhauCollection.insertMany(allChangeRecords);
                console.log(`Created ${allChangeRecords.length} population change records.`);
            }
        }
        
        // Disconnect from database
        await mongoose.disconnect();
        console.log("Disconnected from database");
        
    } catch (error) {
        console.error("Error generating residents:", error);
        await mongoose.disconnect();
    }
}

// Run the generator function
generateResidents();