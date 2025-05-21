// generate-maintenance-data.js
// A utility script to create sample maintenance request data

const mongoose = require('mongoose');
const { MaintenanceRequestCollection, ApartmentCollection, UserCollection } = require('./config');

async function generateMaintenanceData() {
    try {
        // Connect to database
        await mongoose.connect("mongodb://0.0.0.0:27017/BlueMoonApartment");
        console.log("Connected to database");

        // Check if maintenance requests already exist
        const existingCount = await MaintenanceRequestCollection.countDocuments();
        console.log(`${existingCount} maintenance requests already exist.`);

        if (existingCount > 0) {
            console.log("Maintenance data already exists. Exiting...");
            await mongoose.disconnect();
            return;
        }

        // Get apartments and admin user for references
        const apartments = await ApartmentCollection.find();
        
        if (apartments.length === 0) {
            console.log("No apartments found. Please create apartments first.");
            await mongoose.disconnect();
            return;
        }
        
        const admin = await UserCollection.findOne({ role: 'admin' });
        
        if (!admin) {
            console.log("Admin user not found. Please create an admin user first.");
            await mongoose.disconnect();
            return;
        }
        
        console.log("Generating sample maintenance requests...");
        
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
            "Thay thế ổ khóa",
            "Vệ sinh hệ thống thông gió",
            "Sửa chữa tường nứt",
            "Bảo trì hệ thống PCCC",
            "Sửa chữa sàn gỗ",
            "Thay thế thiết bị vệ sinh"
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
            "Ổ khóa cửa chính bị hỏng, không thể khóa hoặc mở bình thường.",
            "Hệ thống thông gió cần được vệ sinh để đảm bảo không khí trong lành.",
            "Có vết nứt trên tường cần được sửa chữa và sơn lại.",
            "Hệ thống phòng cháy chữa cháy cần được kiểm tra và bảo trì định kỳ.",
            "Sàn gỗ trong phòng khách bị hư hỏng và cần được sửa chữa hoặc thay thế.",
            "Bồn cầu và vòi sen trong phòng tắm không hoạt động bình thường và cần được thay thế."
        ];
        
        const priorities = ['low', 'medium', 'high', 'emergency'];
        const statuses = ['pending', 'in-progress', 'completed', 'cancelled'];
        
        // Generate 20 random maintenance requests
        const maintenanceRequests = [];
        
        for (let i = 0; i < 20; i++) {
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
            
            // Add additional notes based on status
            if (status === 'in-progress') {
                const assignDate = new Date(pastDate);
                assignDate.setDate(assignDate.getDate() + 1);
                
                request.notes.push({
                    text: `Phân công cho nhân viên kỹ thuật.`,
                    addedBy: admin._id,
                    addedAt: assignDate
                });
            } else if (status === 'completed') {
                const assignDate = new Date(pastDate);
                assignDate.setDate(assignDate.getDate() + 1);
                
                const completeDate = new Date(today);
                completeDate.setDate(completeDate.getDate() - 1);
                
                request.notes.push({
                    text: `Phân công cho nhân viên kỹ thuật.`,
                    addedBy: admin._id,
                    addedAt: assignDate
                });
                
                request.notes.push({
                    text: `Hoàn thành sửa chữa. Đã kiểm tra và xác nhận hoạt động bình thường.`,
                    addedBy: admin._id,
                    addedAt: completeDate
                });
            } else if (status === 'cancelled') {
                const cancelDate = new Date(pastDate);
                cancelDate.setDate(cancelDate.getDate() + 2);
                
                request.notes.push({
                    text: `Hủy yêu cầu do cư dân đã tự sửa chữa.`,
                    addedBy: admin._id,
                    addedAt: cancelDate
                });
            }
            
            maintenanceRequests.push(request);
        }
        
        // Insert maintenance requests into database
        await MaintenanceRequestCollection.insertMany(maintenanceRequests);
        console.log(`Successfully created ${maintenanceRequests.length} maintenance requests.`);
        
        // Disconnect from database
        await mongoose.disconnect();
        console.log("Disconnected from database");
    } catch (error) {
        console.error("Error generating maintenance data:", error);
        await mongoose.disconnect();
    }
}

// Run the generator function
generateMaintenanceData();