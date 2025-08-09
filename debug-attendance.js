const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAttendance() {
  try {
    // Check attendance table structure and data
    const attendances = await prisma.attendance.findMany({
      take: 3,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            userId: true
          }
        }
      }
    });
    
    console.log('Sample attendance records:');
    console.log(JSON.stringify(attendances, null, 2));
    
    // Check if there's attendance data for the test user
    const testUser = await prisma.user.findFirst({
      where: {
        userId: 'ADST0000001'
      }
    });
    
    if (testUser) {
      console.log('\nTest user found:', testUser.id);
      
      const userAttendances = await prisma.attendance.findMany({
        where: {
          userId: testUser.id
        },
        take: 3
      });
      
      console.log('Test user attendances:', userAttendances.length);
      console.log(JSON.stringify(userAttendances, null, 2));
    }
    
    // Check shifts
    const shifts = await prisma.shift.findMany({
      take: 3,
      include: {
        user: {
          select: {
            name: true,
            userId: true
          }
        }
      }
    });
    
    console.log('\nSample shift records:');
    console.log(JSON.stringify(shifts, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAttendance();