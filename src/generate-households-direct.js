// generate-households-direct.js
const mongoose = require('mongoose');
const { HoKhauCollection, BienDoiNhanKhauCollection } = require('./config');

async function generateHouseholds() {
    try {
        // Connect to database
        await mongoose.connect("mongodb://0.0.0.0:27017/BlueMoonApartment");
        console.log("Connected to database");

        // Check if households already exist
        const existingCount = await HoKhauCollection.countDocuments();
        console.log(`${existingCount} households already exist.`);

        console.log("Generating 100 household records...");
        
        // Vietnamese surnames and names for realistic data
        const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
        const middleNames = ['Văn', 'Thị', 'Hữu', 'Đức', 'Quang', 'Minh', 'Hoàng', 'Thanh', 'Thành', 'Đình', 'Công', 'Anh', 'Thu', 'Thúy', 'Tuấn'];
        const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Hùng', 'Hải', 'Giang', 'Linh', 'Mai', 'Nam', 'Phong', 'Quân', 'Thắng', 'Tú', 'Việt', 'Yến'];
        
        // Generate building blocks and floors
        const blocks = ['A', 'B', 'C'];
        const floors = Array.from({length: 10}, (_, i) => i + 1); // 10 floors
        
        // Batch for insertion
        const households = [];
        let count = 0;
        
        // Generate households for each block and floor
        for (const block of blocks) {
            for (const floor of floors) {
                // 1-6 apartments per floor
                const apartmentsOnFloor = Math.floor(Math.random() * 6) + 1;
                
                for (let unit = 1; unit <= apartmentsOnFloor; unit++) {
                    if (count >= 100) break; // Stop after 100 households
                    
                    // Generate household head name
                    const surname = surnames[Math.floor(Math.random() * surnames.length)];
                    const middleName = middleNames[Math.floor(Math.random() * middleNames.length)];
                    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                    const fullName = `${surname} ${middleName} ${lastName}`;
                    
                    // Generate household number with proper formatting
                    const householdNumber = `HK${block}${String(floor).padStart(2, '0')}${String(unit).padStart(2, '0')}`;
                    
                    // Generate apartment address
                    const apartmentNumber = `${block}${String(floor).padStart(2, '0')}${String(unit).padStart(2, '0')}`;
                    const address = `Căn hộ ${apartmentNumber}, Tòa ${block}, BlueMoon Apartment`;
                    
                    // Generate random registration date within last 5 years
                    const today = new Date();
                    const startDate = new Date(today);
                    startDate.setFullYear(today.getFullYear() - 5);
                    const randomDate = new Date(startDate.getTime() + Math.random() * (today.getTime() - startDate.getTime()));
                    
                    // Create household object
                    const household = {
                        soHoKhau: householdNumber,
                        hoTenChuHo: fullName,
                        diaChi: address,
                        ngayLamHoKhau: randomDate,
                        ghiChu: `Hộ khẩu tự động tạo cho căn hộ ${apartmentNumber}`
                    };
                    
                    households.push(household);
                    count++;
                }
                
                if (count >= 100) break; // Stop after 100 households
            }
            
            if (count >= 100) break; // Stop after 100 households
        }
        
        // Insert all households into database
        if (households.length > 0) {
            const result = await HoKhauCollection.insertMany(households);
            console.log(`Successfully created ${result.length} household records.`);
            
            // Create BienDoiNhanKhau records for each new household
            const bienDoiRecords = [];
            
            for (const household of result) {
                bienDoiRecords.push({
                    hoKhau: household._id,
                    loaiThayDoi: 'Thêm mới',
                    ngayThayDoi: new Date(),
                    noiDung: `Thêm mới hộ khẩu số ${household.soHoKhau}`,
                    nguoiThucHien: 'system'
                });
            }
            
            if (bienDoiRecords.length > 0) {
                await BienDoiNhanKhauCollection.insertMany(bienDoiRecords);
                console.log(`Created ${bienDoiRecords.length} corresponding population change records.`);
            }
        }
        
        // Disconnect from database
        await mongoose.disconnect();
        console.log("Disconnected from database");
    } catch (error) {
        console.error("Error generating households:", error);
        await mongoose.disconnect();
    }
}

// Run the generator function
generateHouseholds();