import {PubSubEngine} from 'graphql-subscriptions/dist/pubsub-engine';
import {AmqpConnectionConfig, QueueConfig} from './configuration'
import {AMQPConnectionFactory} from './connectionFactory'
import {AMQPSubscriber} from './subscriber'
import {AMQPPublisher} from './publisher'
import {PubSubAsyncIterator} from './pubsub-async-iterator'
import {each} from 'async';

export interface PubSubAMQPOptions {
  config: AmqpConnectionConfig;
  connectionListener?: (err: Error) => void;
  triggerTransform?: TriggerTransform;
}

export class AmqpPubSub implements PubSubEngine {
  private consumer: AMQPSubscriber;
  private producer: AMQPPublisher;
  private subscriptionMap: { [subId: number]: [string, Function] };
  private subsRefsMap: { [trigger: string]: Array<number> };
  private currentSubscriptionId: number;
  private triggerTransform: TriggerTransform;
  private unsubscribeChannel: any;

  constructor(public options: PubSubAMQPOptions) {
    this.triggerTransform = options.triggerTransform || (trigger => trigger as string);
    const config = options.config

    const factory = new AMQPConnectionFactory(config);

    this.consumer = new AMQPSubscriber(factory);
    this.producer = new AMQPPublisher(factory);

    this.subscriptionMap = {};
    this.subsRefsMap = {};
    this.currentSubscriptionId = 0;

  }

  publish(trigger: string, payload: any): boolean {
    // As PubSubEngine publish interface is sync, spin up a promise asynchronously, and just return true
    // All implementations are built this way and there seems to be no workaround without changing
    // graphql-subscription, so we must (regardless of implementation) make sure that system doesn't
    // depend on order of the events.
    this.producer.publish(new QueueConfig(trigger), payload);
    return true;
  }

  public subscribe(trigger: string, onMessage: Function, options?: Object): Promise<number> {
    const triggerName: string = this.triggerTransform(trigger, options);
    const id = this.currentSubscriptionId++;
    this.subscriptionMap[id] = [triggerName, onMessage];
    let refs = this.subsRefsMap[triggerName];
    if (refs && refs.length > 0) {
      this.subsRefsMap[triggerName] = [...refs, id];
      return Promise.resolve(id);
    } else {
      return new Promise<number>((resolve, reject) => {
        return this.consumer.subscribe(
          new QueueConfig(triggerName, this.options.config.service),
          (msg) => new Promise((resolve, reject) => {
            resolve(this.onMessage(triggerName, msg))
          })
        )
          .then(disposer => {
            this.subsRefsMap[triggerName] = [...(this.subsRefsMap[triggerName] || []), id];
            this.unsubscribeChannel = disposer;
            return resolve(id);
          })
          .catch(err => {
            reject(id);
          });
      });
    }
  }

  unsubscribe(subId: number): any {
    const [triggerName = null] = this.subscriptionMap[subId] || [];
    const refs = this.subsRefsMap[triggerName];

    if (!refs) {
      throw new Error(`There is no subscription of id "{subId}"`);
    }

    let newRefs;
    if (refs.length === 1) {
      newRefs = [];
      this.unsubscribeChannel().then(() => {
      }).catch(err => {
      });
    } else {
      const index = refs.indexOf(subId);
      if (index !== -1) {
        newRefs = [...refs.slice(0, index), ...refs.slice(index + 1)];
      }
    }
    this.subsRefsMap[triggerName] = newRefs;
    delete this.subscriptionMap[subId];
  }

  public asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
    return new PubSubAsyncIterator<T>(this, triggers);
  }

  private onMessage(channel: string, message: string) {
    const subscribers = this.subsRefsMap[channel];

    // Don't work for nothing..
    if (!subscribers || !subscribers.length) {
      return;
    }

    each(subscribers, (subId, cb) => {
      // TODO Support pattern based subscriptions
      const [triggerName, listener] = this.subscriptionMap[subId];
      listener(message);
      cb();
    });
  }

}

export type Path = Array<string | number>;
export type Trigger = string | Path;
export type TriggerTransform = (trigger: Trigger, channelOptions?: Object) => string;

