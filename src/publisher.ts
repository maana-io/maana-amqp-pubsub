import { AMQPConnectionFactory } from "./connectionFactory";
import { QueueConfig } from "./configuration";
import * as amqp from "amqplib";

export class AMQPPublisher {
  constructor(private connectionFactory: AMQPConnectionFactory) {}

  publish<T>(queueConfig: QueueConfig, message: T): Promise<void> {
    return this.connectionFactory
      .create()
      .then(connection => connection.createChannel())
      .then(channel => {
        AMQPPublisher.setupChannel(channel, queueConfig)
          .then(() => {
            channel.publish(
              queueConfig.publishExchange,
              "",
              AMQPPublisher.getMessageBuffer(message)
            );
            // As channel is created for every message, it must be closed, otherwise it will never go away and slow down rabbitmq
            channel.close();
          })
          .catch(() => {
            // We don't need to terminate here as publishing a message may fail due to intermittent failure
            return Promise.reject(new Error("Unable to send message"));
          });
      });
  }

  protected static async setupChannel(
    channel: amqp.Channel,
    queueConfig: QueueConfig
  ) {
    try {
      await channel.assertExchange(queueConfig.publishExchange, "fanout");
    } catch (err) {
      // Failure to set up exchanges is 'terminal error' - meaning that likely RabbitMQ is not yet completed startup
      console.error("Failed to set up Publisher Exchanges and queues", err);
      process.exit(-1);
      throw new Error("Unreachable, killing and restarting application");
    }
  }

  protected static getMessageBuffer<T>(message: T) {
    return new Buffer(JSON.stringify(message), "utf8");
  }
}
