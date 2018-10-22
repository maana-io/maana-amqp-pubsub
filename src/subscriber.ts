import {AMQPConnectionFactory} from './connectionFactory';
import {QueueConfig} from "./configuration";
import * as amqp from 'amqplib';
import {Channel} from "amqplib";


export class AMQPSubscriber {
  constructor(private connectionFactory: AMQPConnectionFactory) {
  }

  subscribe(queueConfig: QueueConfig, action: (message: any) => Promise<any>): Promise<any> {
    return this.connectionFactory.create()
      .then(connection => connection.createChannel())
      .then(channel => {
        return AMQPSubscriber.setupChannel(channel, queueConfig)
          .then(() => {
            // console.log('Channels are set up, subscribing to queue', queueConfig)
            return this.subscribeToChannel(channel, queueConfig, action)
          })
      })
  }


  protected subscribeToChannel(channel: amqp.Channel, queueConfig: QueueConfig, action: (message: any) => Promise<any>): Promise<any> {
    return Promise.resolve(
      channel.consume(queueConfig.subscribeQueue, (message) => {
        return new Promise((resolve, reject) => {
          const msg = AMQPSubscriber.getMessageObject(message);
          // console.log('Got message, invoking action', msg);
          // console.log(typeof action)
          return resolve(
            action(msg)
            .then(() => {
              // If action succeeded, ack - so that other services don't get the event
              return channel.ack(message);
            }).catch((err) => {
              // Otherwise nack and return message to the queue
              return channel.nack(message, false, false);
            }))
        })
      }));
  }

  protected static async setupChannel(channel: amqp.Channel, queueConfig: QueueConfig): Promise<string> {
    try {
      await channel.assertExchange(queueConfig.publishExchange, 'fanout');
      let result = await channel.assertQueue(queueConfig.subscribeQueue);
      await channel.bindQueue(result.queue, queueConfig.publishExchange, '')
      return result.queue;
    } catch(err) {
      // Failure to set up exchanges is 'terminal error' - meaning that likely RabbitMQ is not yet completed startup
      console.error('Failed to set up Subscriber Exchanges and queues', err)
      process.exit(-1);
      throw new Error("Unreachable, killing and restarting application");
    }
  }

  protected static getMessageObject<T>(message: amqp.Message) {
    return JSON.parse(message.content.toString('utf8')) as T;
  }
}