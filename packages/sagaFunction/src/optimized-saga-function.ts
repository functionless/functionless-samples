import { Construct } from 'constructs';
import { $AWS, StepFunction, Function, ITable } from 'functionless';
import { BookingEntry, ReservationRequest } from './types';

interface SagaFunctionProps {
  bookingsTable: ITable<BookingEntry, 'pk', 'sk'>;
}

export class OptimizedSagaFunction extends Construct {
  readonly func: StepFunction<ReservationRequest, string>;

  constructor(scope: Construct, id: string, props: SagaFunctionProps) {
    super(scope, id);

    const hashCode = new Function(this, 'hashCode', async (s: string) => {
      let h: any;

      for (let i = 0; i < s.length; i++) {
        // eslint-disable-next-line no-bitwise
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      }

      return '' + Math.abs(h);
    });

    // Once retry is supported, add chaos
    // const chaos = new Function(scope, "chaos", async () => {
    //   if (Math.random() < 0.4) {
    //     throw new Error("Internal Server Error");
    //   }
    // });

    this.func = new StepFunction(
      this,
      'sagaFunction',
      async (event: ReservationRequest) => {
        const reservation = event.reservation;
        let hotelBookingID;
        let flightBookingID;
        let paymentID;
        try {
          hotelBookingID = await hashCode(
            `${reservation.trip_id}${reservation.hotel}${reservation.check_in}`,
          );

          // If we passed the parameter to fail this step
          if (event.run_type === 'failHotelReservation') {
            throw new Error('Failed to reserve the hotel');
          }

          // Call DynamoDB to add the item to the table
          await $AWS.DynamoDB.PutItem({
            Table: props.bookingsTable,
            Item: {
              pk: { S: reservation.trip_id },
              sk: { S: `HOTEL#${hotelBookingID}` },
              trip_id: { S: reservation.trip_id },
              type: { S: 'Hotel' },
              id: { S: hotelBookingID },
              hotel: { S: reservation.hotel },
              check_in: { S: reservation.check_in },
              check_out: { S: reservation.check_out },
              transaction_status: { S: 'pending' },
            },
          });

          // If we passed the parameter to fail this step
          if (event.run_type === 'failFlightsReservation') {
            throw new Error('Failed to book the flights');
          }

          flightBookingID = await hashCode(
            `${reservation.trip_id}${reservation.depart}${reservation.arrive}`,
          );

          // Call DynamoDB to add the item to the table
          await $AWS.DynamoDB.PutItem({
            Table: props.bookingsTable,
            Item: {
              pk: { S: reservation.trip_id },
              sk: { S: `FLIGHT#${flightBookingID}` },
              type: { S: 'Flight' },
              trip_id: { S: reservation.trip_id },
              id: { S: flightBookingID },
              depart: { S: reservation.depart },
              depart_at: { S: reservation.depart_at },
              arrive: { S: reservation.arrive },
              arrive_at: { S: reservation.arrive_at },
              transaction_status: { S: 'pending' },
            },
          });

          paymentID = await hashCode(
            `${reservation.trip_id}${hotelBookingID}${flightBookingID}`,
          );

          // If we passed the parameter to fail this step
          if (event.run_type === 'failPayment') {
            throw new Error('Failed to book the flights');
          }

          // Call DynamoDB to add the item to the table
          await $AWS.DynamoDB.PutItem({
            Table: props.bookingsTable,
            Item: {
              pk: { S: reservation.trip_id },
              sk: { S: `PAYMENT#${paymentID}` },
              type: { S: 'Payment' },
              trip_id: { S: reservation.trip_id },
              id: { S: paymentID },
              amount: { S: '450.00' },
              currency: { S: 'USD' },
              transaction_status: { S: 'confirmed' },
            },
          });

          // If we passed the parameter to fail this step
          if (event.run_type === 'failHotelConfirmation') {
            throw new Error('Failed to confirm the hotel booking');
          }

          // Call DynamoDB to add the item to the table
          await $AWS.DynamoDB.UpdateItem({
            Table: props.bookingsTable,
            Key: {
              pk: { S: reservation.trip_id },
              sk: { S: `HOTEL#${hotelBookingID}` },
            },
            UpdateExpression: 'set transaction_status = :booked',
            ExpressionAttributeValues: {
              ':booked': { S: 'confirmed' },
            },
          });

          // If we passed the parameter to fail this step
          if (event.run_type === 'failFlightsConfirmation') {
            throw new Error('Failed to book the flights');
          }

          // Call DynamoDB to add the item to the table
          await $AWS.DynamoDB.UpdateItem({
            Table: props.bookingsTable,
            Key: {
              pk: { S: reservation.trip_id },
              sk: { S: `FLIGHT#${flightBookingID}` },
            },
            UpdateExpression: 'set transaction_status = :booked',
            ExpressionAttributeValues: {
              ':booked': { S: 'confirmed' },
            },
          });
        } catch {
          if (paymentID) {
            // NEED: Retry(3)
            // await chaos()
            await $AWS.DynamoDB.DeleteItem({
              Table: props.bookingsTable,
              Key: {
                pk: { S: reservation.trip_id },
                sk: { S: `PAYMENT#${paymentID}` },
              },
            });
          }
          if (flightBookingID) {
            // NEED: Retry(3)
            // await chaos()
            await $AWS.DynamoDB.DeleteItem({
              Table: props.bookingsTable,
              Key: {
                pk: { S: reservation.trip_id },
                sk: { S: `FLIGHT#${flightBookingID}` },
              },
            });
          }

          if (hotelBookingID) {
            // NEED: Retry(3)
            // await chaos()
            await $AWS.DynamoDB.DeleteItem({
              Table: props.bookingsTable,
              Key: {
                pk: { S: reservation.trip_id },
                sk: { S: `HOTEL#${hotelBookingID}` },
              },
            });
          }

          throw Error("Sorry, We Couldn't make the booking");
        }

        return 'We have made your booking!';
      },
    );
  }
}
