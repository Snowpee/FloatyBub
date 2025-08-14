/**
 * Snowflake ID 生成器
 * 用于分布式环境下生成全局唯一且时间有序的ID
 */

class SnowflakeIdGenerator {
  private static readonly EPOCH = 1640995200000; // 2022-01-01 00:00:00 UTC
  private static readonly DATACENTER_ID_BITS = 5;
  private static readonly MACHINE_ID_BITS = 5;
  private static readonly SEQUENCE_BITS = 12;
  
  private static readonly MAX_DATACENTER_ID = (1 << this.DATACENTER_ID_BITS) - 1;
  private static readonly MAX_MACHINE_ID = (1 << this.MACHINE_ID_BITS) - 1;
  private static readonly MAX_SEQUENCE = (1 << this.SEQUENCE_BITS) - 1;
  
  private static readonly MACHINE_ID_SHIFT = this.SEQUENCE_BITS;
  private static readonly DATACENTER_ID_SHIFT = this.SEQUENCE_BITS + this.MACHINE_ID_BITS;
  private static readonly TIMESTAMP_SHIFT = this.SEQUENCE_BITS + this.MACHINE_ID_BITS + this.DATACENTER_ID_BITS;
  
  private datacenterId: number;
  private machineId: number;
  private sequence: number = 0;
  private lastTimestamp: number = -1;
  
  constructor(datacenterId: number = 1, machineId: number = 1) {
    this.datacenterId = datacenterId & 0x1f; // 5 bits
    this.machineId = machineId & 0x1f; // 5 bits
    this.sequence = 0;
    
    // 在开发环境中使用固定值，生产环境中可以从环境变量获取
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      this.datacenterId = 1;
      this.machineId = 1;
    }
  }
  
  public generateId(): string {
    let timestamp = Date.now();
    
    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate id');
    }
    
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & SnowflakeIdGenerator.MAX_SEQUENCE;
      if (this.sequence === 0) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }
    
    this.lastTimestamp = timestamp;
    
    const id = (BigInt(timestamp - SnowflakeIdGenerator.EPOCH) << BigInt(SnowflakeIdGenerator.TIMESTAMP_SHIFT)) |
      (BigInt(this.datacenterId) << BigInt(SnowflakeIdGenerator.DATACENTER_ID_SHIFT)) |
      (BigInt(this.machineId) << BigInt(SnowflakeIdGenerator.MACHINE_ID_SHIFT)) |
      BigInt(this.sequence);

    return id.toString();
  }
  
  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }
  
  public static parseId(snowflakeId: string): {
    timestamp: number;
    datacenterId: number;
    machineId: number;
    sequence: number;
  } {
    const id = BigInt(snowflakeId);
    
    const timestamp = Number((id >> BigInt(SnowflakeIdGenerator.TIMESTAMP_SHIFT)) + BigInt(SnowflakeIdGenerator.EPOCH));
    const datacenterId = Number((id >> BigInt(SnowflakeIdGenerator.DATACENTER_ID_SHIFT)) & BigInt(SnowflakeIdGenerator.MAX_DATACENTER_ID));
    const machineId = Number((id >> BigInt(SnowflakeIdGenerator.MACHINE_ID_SHIFT)) & BigInt(SnowflakeIdGenerator.MAX_MACHINE_ID));
    const sequence = Number(id & BigInt(SnowflakeIdGenerator.MAX_SEQUENCE));
    
    return { timestamp, datacenterId, machineId, sequence };
  }
}

// 全局实例
export const snowflakeGenerator = new SnowflakeIdGenerator(
  parseInt((typeof process !== 'undefined' && process.env?.DATACENTER_ID) || '1'),
  parseInt((typeof process !== 'undefined' && process.env?.MACHINE_ID) || '1')
);

export const generateSnowflakeId = (): string => {
  return snowflakeGenerator.generateId();
};

export { SnowflakeIdGenerator };