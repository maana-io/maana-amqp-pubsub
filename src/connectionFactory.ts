import * as amqp from "amqplib";
import { AmqpConnectionConfig } from "./configuration";

export class AMQPConnectionFactory {
  private connection: string;
  private promise: Promise<amqp.Connection>;

  constructor(config: AmqpConnectionConfig) {
    this.connection = `amqp://${config.host}:${config.port}`;
  }

  create(): Promise<amqp.Connection> {
    // Reusing connection if possible. If connection is not available, die so that service is restarted.
    if (this.promise) {
      return this.promise;
    } else {
      return (this.promise = Promise.resolve(
        amqp.connect(this.connection)
      ).catch(err => {
        console.error("Connection to RabbitMQ PubSub failed, terminating", err);
        process.exit(-1);
        throw new Error("Unreachable, killing and restarting application");
      }));
    }
  }
}
