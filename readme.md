Based on https://github.com/cdmbase/rabbitmq-pubsub and https://github.com/cdmbase/graphql-rabbitmq-subscriptions

## Changes to original

* Queues are configured as (publish exchange of event type, fanout) -> (event type queue of specific service type). So only one instance of a service will get the event.

## Example usage

```
import { AmqpPubSub } from 'maana-amqp-pubsub'

const RABBITMQ_ADDR = process.env.RABBITMQ_ADDR || '127.0.0.1'
const RABBITMQ_PORT = parseInt(process.env.RABBITMQ_PORT || '5672')
const SERVICE_ID    = process.env.SERVICE_ID || 'io.maana.knowledge'

const pubsub = new AmqpPubSub({
  config: {
    host: RABBITMQ_ADDR,
    port: RABBITMQ_PORT,
    service: SERVICE_ID
  }
})

export default pubsub
```
