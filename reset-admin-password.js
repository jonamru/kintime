
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetAdminPassword() {
    const email = 'admin@alphadoor.jp' // メールアドレスを指定
    const newPassword = 'password123' // 単純な一時パスワード

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        // メールアドレスとユーザIDの両方で検索
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { userId: 'admin' } // システム管理者のユーザーID
                ]
            }
        })

        if (!user) {
            console.log('User not found.')
            return
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        })

        console.log(`Password reset for user: ${updatedUser.email} / ${updatedUser.userId}`)
        console.log(`New password: ${newPassword}`)

        // Verify login logic details
        console.log('User ID:', updatedUser.userId)
        console.log('Email:', updatedUser.email)
        console.log('Is Active:', updatedUser.isActive)

    } catch (error) {
        console.error('Error resetting password:', error)
    } finally {
        await prisma.$disconnect()
    }
}

resetAdminPassword()
