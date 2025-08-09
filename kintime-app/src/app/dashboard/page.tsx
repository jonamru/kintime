import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              ダッシュボード
            </h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    ようこそ、{session.user.name}さん
                  </h2>
                  <p className="text-sm text-gray-500">
                    権限: {session.user.role}
                  </p>
                  
                  <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          勤怠管理
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                          <a href="/attendance" className="text-indigo-600 hover:text-indigo-500">
                            打刻する
                          </a>
                        </dd>
                      </div>
                    </div>

                    <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          シフト管理
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                          <a href="/shift" className="text-indigo-600 hover:text-indigo-500">
                            シフト確認
                          </a>
                        </dd>
                      </div>
                    </div>

                    <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          経費申請
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                          <a href="/expense" className="text-indigo-600 hover:text-indigo-500">
                            申請する
                          </a>
                        </dd>
                      </div>
                    </div>

                    {(session.user.role === "SUPER_ADMIN" || session.user.role === "MANAGER") && (
                      <>
                        <div className="bg-yellow-50 overflow-hidden shadow rounded-lg">
                          <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-yellow-700 truncate">
                              シフト管理（管理者）
                            </dt>
                            <dd className="mt-1 text-2xl font-semibold text-yellow-900">
                              <a href="/admin/shift" className="text-yellow-600 hover:text-yellow-500">
                                シフト作成
                              </a>
                            </dd>
                          </div>
                        </div>

                        <div className="bg-green-50 overflow-hidden shadow rounded-lg">
                          <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-green-700 truncate">
                              レポート
                            </dt>
                            <dd className="mt-1 text-2xl font-semibold text-green-900">
                              <a href="/reports" className="text-green-600 hover:text-green-500">
                                分析・出力
                              </a>
                            </dd>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}