import React, { useState } from 'react';

// ============================================
// 1. 封装 DaisyUI 基础组件
// ============================================
const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input 
      className={`input input-bordered w-full ${className}`}
      {...props}
    />
  );
};

const Select = ({ children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => {
  return (
    <select 
      className={`select select-bordered w-full ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};

const Textarea = ({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  return (
    <textarea 
      className={`textarea textarea-bordered w-full ${className}`}
      {...props}
    />
  );
};

// ============================================
// 2. 响应式表单字段组件
// ============================================
const FormField = ({ 
  label, 
  type = 'text',
  as = 'input',
  children,
  isLast = false,
  ...props 
}: {
  label: string;
  type?: string;
  as?: string;
  children?: React.ReactNode;
  isLast?: boolean;
  [key: string]: any;
}) => {
  const renderInput = () => {
    // 移动端样式：去掉 DaisyUI 的边框，使用 iOS 风格
    const mobileClass = `
      border-0 md:border
      bg-transparent md:bg-base-100
      text-[17px] md:text-sm
      text-right md:text-left
      px-0 md:px-4
      h-auto
      focus:outline-none
    `;

    if (as === 'select') {
      return (
        <Select className={mobileClass} {...props}>
          {children}
        </Select>
      );
    }
    
    if (as === 'textarea') {
      return (
        <Textarea 
          className={`
            ${mobileClass}
            md:py-2
            text-left
          `} 
          {...props} 
        />
      );
    }
    
    return <Input type={type} className={mobileClass} {...props} />;
  };

  return (
    <>
      {/* 移动端: iOS 风格 */}
      <div className={`
        md:hidden
        flex items-center
        bg-base-100
        px-4 py-3
        active:bg-base-200
        transition-colors
        ${isLast ? '' : 'border-b border-base-300'}
      `}>
        <label className="text-[17px] font-normal w-24 flex-shrink-0">
          {label}
        </label>
        {renderInput()}
      </div>

      {/* 桌面端: DaisyUI 标准样式 */}
        <label className="hidden md:flex input w-full">
          <span className="label">{label}</span>
          {renderInput()}
        </label>
    </>
  );
};

// ============================================
// 3. 业务表单组件
// ============================================
export default function DaisyUIForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    color: '',
    message: ''
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSubmit = () => {
    alert('表单已提交：\n' + JSON.stringify(formData, null, 2));
  };

  return (
    <div className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        


        {/* 表单卡片 */}
        <div className="card bg-base-100 shadow-xl md:p-2">
          <div className="card-body p-0 md:p-8">
            <h2 className="card-title text-3xl mb-6 px-4 md:px-0 pt-4 md:pt-0">
              联系我们
            </h2>
            
            <div className="md:border-0 md:rounded-none overflow-hidden md:overflow-visible">
              <FormField 
                label="姓名" 
                placeholder="请输入姓名"
                value={formData.name}
                onChange={handleChange('name')}
              />
              
              <FormField 
                label="邮箱" 
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange('email')}
              />
              
              <FormField 
                label="颜色" 
                as="select"
                value={formData.color}
                onChange={handleChange('color')}
              >
                <option value="" disabled>选择颜色</option>
                <option value="crimson">🔴 Crimson</option>
                <option value="amber">🟡 Amber</option>
                <option value="velvet">🟣 Velvet</option>
              </FormField>
              
              <FormField 
                label="留言" 
                as="textarea"
                rows={4}
                placeholder="告诉我们您的想法..."
                value={formData.message}
                onChange={handleChange('message')}
                isLast={true}
              />
            </div>

            <div className="card-actions mt-6 px-4 md:px-0 pb-4 md:pb-0">
              <button 
                onClick={handleSubmit}
                className="btn btn-primary w-full"
              >
                提交
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
