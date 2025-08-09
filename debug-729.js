const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug729() {
  try {
    // 7/29のデータを確認
    const startDate = new Date('2025-07-29T00:00:00.000Z');
    const endDate = new Date('2025-07-29T23:59:59.999Z');
    
    console.log('Checking data for 7/29...');
    console.log('Start:', startDate.toISOString());
    console.log('End:', endDate.toISOString());
    
    // シフトデータ
    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    
    console.log('\nShifts for 7/29:');
    shifts.forEach(shift => {
      console.log({
        id: shift.id,
        userId: shift.userId,
        date: shift.date.toISOString(),
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        breakTime: shift.breakTime,
        location: shift.location
      });
    });
    
    // 勤怠データ
    const attendances = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { clockTime: 'asc' }
    });
    
    console.log('\nAttendances for 7/29:');
    attendances.forEach(att => {
      console.log({
        id: att.id,
        userId: att.userId,
        type: att.type,
        date: att.date.toISOString(),
        clockTime: att.clockTime.toISOString()
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug729();