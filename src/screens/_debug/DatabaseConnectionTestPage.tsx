import React from 'react';
import { DatabaseConnectionIndicator } from './components/DatabaseConnectionIndicator';
import { Database } from 'lucide-react';

const DatabaseConnectionTestPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 md:pt-0">
      {/* 页面标题 */}
      <div className="flex items-center space-x-3">
        <Database className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-base-content">数据库连接测试</h1>
          <p className="text-base-content/70">
            测试和监控数据库连接状态
          </p>
        </div>
      </div>

      {/* 数据库连接状态详情 */}
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <DatabaseConnectionIndicator showDetails={true} />
        </div>
      </div>

      {/* 测试说明 */}
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <h2 className="card-title text-base-content flex items-center mb-4">
            <Database className="h-5 w-5 mr-2" />
            测试说明
          </h2>
          <div className="space-y-3 text-base-content/70">
            <p>
              此页面用于开发和测试数据库连接功能，包括：
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>实时监控数据库连接状态</li>
              <li>测试数据库响应时间</li>
              <li>检查表权限和访问性</li>
              <li>显示连接错误信息</li>
            </ul>
            <div className="alert alert-info mt-4">
              <Database className="h-4 w-4" />
              <span>
                这是一个开发测试页面，用于验证数据库连接组件的功能。
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseConnectionTestPage;