export class AmqpConnectionConfig {
  host: string;
  port: number;
  service?: string;
}

export class QueueConfig {
  publishExchange: string;
  subscribeQueue: string;

  /**
   * @param queueName Queue (event type) to subscribe to
   * @param serviceName Optional name of service. If name is provided, only one instance
   * of service type will get the event. If not provided, all instances will get the message
   */
  constructor(public queueName: string, public serviceName?: string) {
    this.publishExchange = `${queueName}.Exchange.fanout`;
    if (serviceName) {
      this.subscribeQueue = `${queueName}.${serviceName}.Queue`;
    } else {
      this.subscribeQueue = `${queueName}.Queue`;
    }
  }
}
