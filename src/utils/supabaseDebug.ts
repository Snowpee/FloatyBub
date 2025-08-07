import { supabase } from '../lib/supabase'

// 网络诊断结果接口
interface NetworkDiagnostics {
  currentUrl: string
  hostname: string
  isLocalhost: boolean
  isIP: boolean
  corsPreflightSuccess: boolean
  dnsResolutionSuccess?: boolean
  routeCheckSuccess?: boolean
  suggestedUrl?: string
}

// 诊断结果接口
interface DiagnosticResult {
  configCheck: boolean
  authCheck: boolean
  networkCheck: boolean
  tableAccess: boolean
  errors: string[]
  networkDiagnostics?: NetworkDiagnostics
  suggestions?: string[]
}

// Supabase 连接调试工具
export class SupabaseDebugger {
  // 检测当前访问域名和网络环境
  static async detectNetworkEnvironment(): Promise<NetworkDiagnostics> {
    const currentUrl = window.location.href
    const hostname = window.location.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
    
    console.log('🌐 当前网络环境:', {
      url: currentUrl,
      hostname,
      isLocalhost,
      port: window.location.port
    })
    
    const diagnostics: NetworkDiagnostics = {
      currentUrl,
      hostname,
      isLocalhost,
      isIP: /^\d+\.\d+\.\d+\.\d+$/.test(hostname),
      corsPreflightSuccess: false // 将在后续测试中更新
    }
    
    // DNS解析检查
    if (diagnostics.isLocalhost) {
      try {
        console.log('🔍 检查DNS解析...')
        
        // 尝试解析localhost到IP
        const dnsStartTime = performance.now()
        
        // 创建一个隐藏的图片元素来测试DNS解析
        const testDNS = () => {
          return new Promise<boolean>((resolve) => {
            const img = new Image()
            const timeout = setTimeout(() => {
              console.warn('⚠️ DNS解析超时')
              resolve(false)
            }, 3000)
            
            img.onload = img.onerror = () => {
              clearTimeout(timeout)
              const dnsTime = performance.now() - dnsStartTime
              console.log(`✅ DNS解析时间: ${dnsTime.toFixed(2)}ms`)
              resolve(true)
            }
            
            // 尝试访问一个已知的本地资源
            img.src = `http://localhost:${window.location.port}/favicon.ico?t=${Date.now()}`
          })
        }
        
        diagnostics.dnsResolutionSuccess = await testDNS()
        
        // 检查网络路由
        console.log('🛣️ 检查网络路由...')
        const routeStartTime = performance.now()
        
        try {
          // 尝试fetch一个本地资源来测试路由
          const response = await fetch(`http://localhost:${window.location.port}/`, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
          })
          
          const routeTime = performance.now() - routeStartTime
          console.log(`✅ 网络路由正常，响应时间: ${routeTime.toFixed(2)}ms`)
          diagnostics.routeCheckSuccess = true
        } catch (routeError) {
          console.warn('⚠️ 网络路由检查失败:', routeError)
          diagnostics.routeCheckSuccess = false
        }
        
      } catch (error) {
        console.warn('⚠️ DNS/路由检查异常:', error)
        diagnostics.dnsResolutionSuccess = false
        diagnostics.routeCheckSuccess = false
      }
    }
    
    return diagnostics
  }

  // CORS 预检请求测试
  static async testCORSPreflight(supabaseUrl: string, apiKey: string): Promise<boolean> {
    try {
      console.log('🔍 测试CORS预检请求...')
      
      // 发送OPTIONS请求测试CORS
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'apikey,authorization,content-type',
          'Origin': window.location.origin
        }
      })
      
      const corsAllowed = response.ok && response.headers.get('Access-Control-Allow-Origin')
      console.log('🔍 CORS预检结果:', {
        status: response.status,
        allowOrigin: response.headers.get('Access-Control-Allow-Origin'),
        allowMethods: response.headers.get('Access-Control-Allow-Methods'),
        allowHeaders: response.headers.get('Access-Control-Allow-Headers')
      })
      
      return !!corsAllowed
    } catch (error) {
      console.error('❌ CORS预检测试失败:', error)
      return false
    }
  }

  // 生成访问建议
  static generateAccessSuggestions(networkDiag: NetworkDiagnostics, results?: any): string[] {
    const suggestions: string[] = []
    
    // 域名差异检测和建议
    if (networkDiag.isLocalhost) {
      console.log('🔍 检测到localhost访问，分析差异...')
      
      // 获取当前IP地址建议
      const currentPort = window.location.port || '5173'
      const suggestedIP = '192.168.31.177' // 用户提到的工作IP
      const suggestedUrl = `http://${suggestedIP}:${currentPort}`
      
      suggestions.push(`🌐 当前使用localhost访问可能存在问题`)
      suggestions.push(`💡 建议改用IP地址访问: ${suggestedUrl}`)
      
      // DNS解析问题检测
      if (networkDiag.dnsResolutionSuccess === false) {
        suggestions.push('🔧 DNS解析失败，localhost可能无法正确解析到127.0.0.1')
        suggestions.push('🛠️ 尝试在hosts文件中添加: 127.0.0.1 localhost')
      }
      
      // 网络路由问题检测
      if (networkDiag.routeCheckSuccess === false) {
        suggestions.push('🛣️ 网络路由检查失败，本地回环可能存在问题')
        suggestions.push('🔄 重启网络服务或检查网络适配器设置')
      }
      
      // 数据库连接差异分析
      if (results && !results.tableAccess) {
        suggestions.push('📊 数据库表访问失败，这在IP访问时通常正常')
        suggestions.push('🔐 可能是浏览器对localhost的安全策略更严格')
        suggestions.push('🌍 Supabase服务可能对localhost域名有特殊限制')
      }
      
      // CORS相关建议
      if (!networkDiag.corsPreflightSuccess) {
        suggestions.push('❌ CORS预检失败，localhost可能被Supabase拒绝')
        suggestions.push('✅ IP地址访问通常不会遇到此问题')
      }
      
      // 浏览器安全策略建议
      suggestions.push('🔒 浏览器对localhost的安全策略可能更严格')
      suggestions.push('🚀 生产环境建议使用域名而非localhost')
      
    } else if (networkDiag.isIP) {
      console.log('✅ 检测到IP地址访问，通常更稳定')
      suggestions.push('✅ 当前使用IP地址访问，这是推荐的方式')
      suggestions.push('📝 可以将此IP地址添加到书签以便快速访问')
    }
    
    // 通用建议
    if (results && results.errors.length > 0) {
      suggestions.push('🔍 如问题持续，请检查网络连接和Supabase服务状态')
      suggestions.push('📞 联系网络管理员检查防火墙和代理设置')
    }
    
    return suggestions
  }

  static async testConnection() {
    console.log('🔍 开始 Supabase 连接诊断...')
    
    // 检测网络环境
    const networkDiag = await this.detectNetworkEnvironment()
    
    const results = {
      configCheck: false,
      authCheck: false,
      networkCheck: false,
      tableAccess: false,
      errors: [] as string[],
      networkDiagnostics: networkDiag,
      suggestions: [] as string[]
    }

    try {
      // 1. 检查配置
      console.log('1️⃣ 检查 Supabase 配置...')
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!url || !key) {
        results.errors.push('缺少必要的环境变量')
        console.error('❌ 环境变量缺失:', { url: !!url, key: !!key })
      } else {
        results.configCheck = true
        console.log('✅ 配置检查通过')
        
        // 测试CORS预检
        networkDiag.corsPreflightSuccess = await this.testCORSPreflight(url, key)
        results.networkDiagnostics = networkDiag
      }

      // 2. 检查认证状态
      console.log('2️⃣ 检查认证状态...')
      try {
        // 根据网络环境调整超时时间
        const authTimeoutDuration = networkDiag.isLocalhost ? 20000 : 10000 // localhost使用更长超时
        console.log(`⏱️ 认证检查超时设置: ${authTimeoutDuration/1000}秒 (${networkDiag.isLocalhost ? 'localhost环境' : '正常环境'})`)
        
        const authPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`认证状态检查超时 (${authTimeoutDuration/1000}秒)`)), authTimeoutDuration)
        })
        
        const { data: { session }, error: sessionError } = await Promise.race([
          authPromise,
          timeoutPromise
        ]) as any
        
        if (sessionError) {
          results.errors.push(`认证错误: ${sessionError.message}`)
          console.error('❌ 认证状态检查失败:', sessionError)
        } else {
          results.authCheck = true
          console.log('✅ 认证状态:', session ? '已登录' : '未登录')
          if (session) {
            console.log('👤 用户信息:', {
              id: session.user.id,
              email: session.user.email,
              expires_at: new Date(session.expires_at! * 1000).toLocaleString()
            })
          }
        }
      } catch (authError) {
        results.errors.push(`认证检查异常: ${authError}`)
        console.error('❌ 认证检查异常:', authError)
      }

      // 3. 检查网络连接
      console.log('3️⃣ 检查网络连接...')
      try {
        // 根据网络环境调整超时时间
        const networkTimeoutDuration = networkDiag.isLocalhost ? 12000 : 8000 // localhost使用更长超时
        console.log(`⏱️ 网络检查超时设置: ${networkTimeoutDuration/1000}秒 (${networkDiag.isLocalhost ? 'localhost环境' : '正常环境'})`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), networkTimeoutDuration)
        
        const response = await fetch(`${url}/rest/v1/`, {
          method: 'HEAD',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          results.networkCheck = true
          console.log('✅ 网络连接正常')
        } else {
          results.errors.push(`网络连接失败: ${response.status} ${response.statusText}`)
          console.error('❌ 网络连接失败:', response.status, response.statusText)
        }
      } catch (networkError) {
        const errorMsg = networkError instanceof Error && networkError.name === 'AbortError' 
          ? '网络连接超时' 
          : `网络连接异常: ${networkError}`
        results.errors.push(errorMsg)
        console.error('❌ 网络连接异常:', networkError)
      }

      // 4. 检查表访问权限
      console.log('4️⃣ 检查表访问权限...')
      try {
        // 根据网络环境调整超时时间
        const timeoutDuration = networkDiag.isLocalhost ? 15000 : 8000 // localhost使用更长超时
        console.log(`⏱️ 使用${timeoutDuration/1000}秒超时 (${networkDiag.isLocalhost ? 'localhost环境' : '正常环境'})`)
        
        // 尝试多次访问（针对localhost问题）
        let lastError: any = null
        const maxRetries = networkDiag.isLocalhost ? 3 : 1
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 表访问尝试 ${attempt}/${maxRetries}...`)
            
            const tablePromise = supabase
              .from('chat_sessions')
              .select('count', { count: 'exact', head: true })
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`表访问检查超时 (尝试${attempt})`)), timeoutDuration)
            })
            
            const { data, error: tableError } = await Promise.race([
              tablePromise,
              timeoutPromise
            ]) as any
            
            if (tableError) {
              lastError = tableError
              console.warn(`⚠️ 尝试${attempt}失败:`, tableError.message)
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒后重试
                continue
              }
            } else {
              results.tableAccess = true
              console.log(`✅ 表访问正常 (尝试${attempt}成功)`)
              break
            }
          } catch (attemptError) {
            lastError = attemptError
            console.warn(`⚠️ 尝试${attempt}异常:`, attemptError)
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒后重试
              continue
            }
          }
        }
        
        if (!results.tableAccess) {
          results.errors.push(`表访问失败 (${maxRetries}次尝试): ${lastError?.message || lastError}`)
          console.error('❌ 所有表访问尝试均失败:', lastError)
        }
      } catch (tableAccessError) {
        results.errors.push(`表访问异常: ${tableAccessError}`)
        console.error('❌ 表访问异常:', tableAccessError)
      }

    } catch (generalError) {
      results.errors.push(`总体检查异常: ${generalError}`)
      console.error('❌ 总体检查异常:', generalError)
    }

    // 生成访问建议
      const suggestions = this.generateAccessSuggestions(networkDiag, results)
      results.suggestions = suggestions
    
    console.log('🏁 诊断完成:', results)
    
    // 显示访问建议
    if (suggestions.length > 0) {
      console.log('💡 访问建议:')
      suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`)
      })
    }
    
    // 自动重试机制和IP地址访问建议
    if (networkDiag.isLocalhost && (!results.tableAccess || results.errors.length > 0)) {
      console.log('\n🔄 检测到localhost访问问题，提供自动解决方案:')
      
      const currentPort = window.location.port || '5173'
      const suggestedIP = '192.168.31.177'
      const suggestedUrl = `http://${suggestedIP}:${currentPort}`
      
      console.log(`🎯 推荐访问地址: ${suggestedUrl}`)
      console.log('📋 您可以:')
      console.log('   1. 复制上述地址到新标签页打开')
      console.log('   2. 将IP地址添加到浏览器书签')
      console.log('   3. 修改开发服务器配置使用IP地址启动')
      
      // 提供一键复制功能（如果在浏览器环境中）
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(suggestedUrl)
          console.log('✅ 推荐地址已复制到剪贴板')
        } catch (clipboardError) {
          console.log('ℹ️ 请手动复制推荐地址')
        }
      }
      
      // 存储建议的URL到结果中
      results.networkDiagnostics!.suggestedUrl = suggestedUrl
    }
    
    return results
  }

  static async testSpecificQuery(userId: string) {
    console.log('🔍 测试具体查询...')
    
    try {
      // 测试失败的查询
      console.log('测试查询: chat_sessions')
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (sessionsError) {
        console.error('❌ 查询失败:', sessionsError)
        return { success: false, error: sessionsError }
      } else {
        console.log('✅ 查询成功:', sessions?.length || 0, '条记录')
        return { success: true, data: sessions }
      }
    } catch (error) {
      console.error('❌ 查询异常:', error)
      return { success: false, error }
    }
  }

  static logNetworkDetails() {
    console.log('🌐 网络环境信息:')
    console.log('- User Agent:', navigator.userAgent)
    console.log('- Online:', navigator.onLine)
    console.log('- Connection:', (navigator as any).connection?.effectiveType || 'unknown')
    console.log('- Location:', window.location.href)
    console.log('- Referrer:', document.referrer)
  }
}

// 导出便捷函数
export const debugSupabase = () => SupabaseDebugger.testConnection()
export const debugQuery = (userId: string) => SupabaseDebugger.testSpecificQuery(userId)
export const logNetwork = () => SupabaseDebugger.logNetworkDetails()