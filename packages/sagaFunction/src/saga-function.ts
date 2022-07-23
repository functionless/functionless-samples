import { Construct } from 'constructs';
import { $AWS, StepFunction, Function, ITable } from 'functionless';
import { BookingEntry, Reservation } from './types';

interface SagaFunctionProps {
  bookingsTable: ITable<BookingEntry, 'pk', 'sk'>;
}

export class SagaFunction extends Construct {
  constructor(scope: Construct, id: string, props: SagaFunctionProps) {
    super(scope, id);

    interface Result {
      status: 'ok';
    }

    interface ReservationResult extends Result {
      booking_id: string;
    }

    // 1) Flights
    // // this.createLambda(this, 'reserveFlightLambdaHandler', 'flights/reserveFlight.handler', bookingsTable);
    const reserveFlightLambda = new Function<Reservation, ReservationResult>(
      this,
      'reserveFlightLambdaHandler',
      async (event) => {
        console.log('request:', JSON.stringify(event, undefined, 2));

        let flightBookingID = hashCode(
          '' + event.trip_id + event.depart + event.arrive,
        );

        // If we passed the parameter to fail this step
        if (event.run_type === 'failFlightsReservation') {
          throw new Error('Failed to book the flights');
        }

        // Call DynamoDB to add the item to the table
        let result = await $AWS.DynamoDB.PutItem({
          Table: props.bookingsTable,
          Item: {
            pk: { S: event.trip_id },
            sk: { S: 'FLIGHT#' + flightBookingID },
            type: { S: 'Flight' },
            trip_id: { S: event.trip_id },
            id: { S: flightBookingID },
            depart: { S: event.depart },
            depart_at: { S: event.depart_at },
            arrive: { S: event.arrive },
            arrive_at: { S: event.arrive_at },
            transaction_status: { S: 'pending' },
          },
        }).catch((error: any) => {
          throw new Error(error);
        });

        console.log('inserted flight booking:');
        console.log(result);

        // return status of ok
        return {
          status: 'ok',
          booking_id: flightBookingID,
        };
      },
    );

    interface ConfirmFlightRequest {
      ReserveFlightResult: ReservationResult;
      reservation: Reservation;
    }

    // this.createLambda(this,"confirmFlightLambdaHandler","flights/confirmFlight.handler",bookingsTable);
    const confirmFlightLambda = new Function<ConfirmFlightRequest, Result>(
      this,
      'confirmFlightLambdaHandler',
      async (event) => {
        console.log('request:', JSON.stringify(event, undefined, 2));

        // If we passed the parameter to fail this step
        if (event.reservation.run_type === 'failFlightsConfirmation') {
          throw new Error('Failed to book the flights');
        }

        let bookingID = event.ReserveFlightResult.booking_id;

        // Call DynamoDB to add the item to the table
        let result = $AWS.DynamoDB.UpdateItem({
          Table: props.bookingsTable,
          Key: {
            pk: { S: event.reservation.trip_id },
            sk: { S: 'FLIGHT#' + bookingID },
          },
          UpdateExpression: 'set transaction_status = :booked',
          ExpressionAttributeValues: {
            ':booked': { S: 'confirmed' },
          },
        }).catch((error: any) => {
          throw new Error(error);
        });

        console.log('confirmed flight booking:');
        console.log(result);

        // return status of ok
        return {
          status: 'ok',
          booking_id: bookingID,
        };
      },
    );

    interface CancelFlightRequest {
      reservation: Reservation;
      ReserveFlightResult?: ReservationResult;
    }

    // this.createLambda(this,"cancelFlightLambdaHandler","flights/cancelFlight.handler",bookingsTable);
    const cancelFlightLambda = new Function<CancelFlightRequest, Result>(
      this,
      'CancelFlightRequest',
      async (event) => {
        console.log('request:', JSON.stringify(event, undefined, 2));

        if (Math.random() < 0.4) {
          throw new Error('Internal Server Error');
        }

        let bookingID = '';
        if (typeof event.ReserveFlightResult !== 'undefined') {
          bookingID = event.ReserveFlightResult.booking_id;
        }

        // Call DynamoDB to add the item to the table
        let result = await $AWS.DynamoDB.DeleteItem({
          Table: props.bookingsTable,
          Key: {
            pk: { S: event.reservation.trip_id },
            sk: { S: 'FLIGHT#' + bookingID },
          },
        }).catch((error: any) => {
          throw new Error(error);
        });

        console.log('deleted flight booking:');
        console.log(result);

        // return status of ok
        return { status: 'ok' };
      },
    );

    // 2) Hotel

    interface ReserveHotelRequest extends Reservation {}

    // this.createLambda(this,"reserveHotelLambdaHandler","hotel/reserveHotel.handler",bookingsTable);
    const reserveHotelLambda = new Function<
    ReserveHotelRequest,
    ReservationResult
    >(this, 'reserveHotelLambdaHandler', async (event) => {
      console.log('request:', JSON.stringify(event, undefined, 2));

      let hotelBookingID = hashCode(
        '' + event.trip_id + event.hotel + event.check_in,
      );

      // If we passed the parameter to fail this step
      if (event.run_type === 'failHotelReservation') {
        throw new Error('Failed to reserve the hotel');
      }

      // Call DynamoDB to add the item to the table
      let result = await $AWS.DynamoDB.PutItem({
        Table: props.bookingsTable,
        Item: {
          pk: { S: event.trip_id },
          sk: { S: 'HOTEL#' + hotelBookingID },
          trip_id: { S: event.trip_id },
          type: { S: 'Hotel' },
          id: { S: hotelBookingID },
          hotel: { S: event.hotel },
          check_in: { S: event.check_in },
          check_out: { S: event.check_out },
          transaction_status: { S: 'pending' },
        },
      }).catch((error: any) => {
        throw new Error(error);
      });

      console.log('inserted hotel booking:');
      console.log(result);

      return {
        status: 'ok',
        booking_id: hotelBookingID,
      };
    });

    interface ConfirmHotelRequest {
      reservation: Reservation;
      ReserveHotelResult: ReservationResult;
    }

    // this.createLambda(this,"confirmHotelLambdaHandler","hotel/confirmHotel.handler",bookingsTable);
    const confirmHotelLambda = new Function<ConfirmHotelRequest, Result>(
      this,
      'confirmHotelLambdaHandler',
      async (event) => {
        console.log('request:', JSON.stringify(event, undefined, 2));

        // If we passed the parameter to fail this step
        if (event.reservation.run_type === 'failHotelConfirmation') {
          throw new Error('Failed to confirm the hotel booking');
        }

        let bookingID = event.ReserveHotelResult.booking_id;

        // Call DynamoDB to add the item to the table
        let result = await $AWS.DynamoDB.UpdateItem({
          Table: props.bookingsTable,
          Key: {
            pk: { S: event.reservation.trip_id },
            sk: { S: 'HOTEL#' + bookingID },
          },
          UpdateExpression: 'set transaction_status = :booked',
          ExpressionAttributeValues: {
            ':booked': { S: 'confirmed' },
          },
        }).catch((error: any) => {
          throw new Error(error);
        });

        console.log('updated hotel booking:');
        console.log(result);

        // return status of ok
        return {
          status: 'ok',
          booking_id: bookingID,
        };
      },
    );

    interface CancelHotelRequest {
      reservation: Reservation;
      ReserveHotelResult?: ReservationResult;
    }

    // this.createLambda(this,"cancelHotelLambdaHandler","hotel/cancelHotel.handler",bookingsTable);
    const cancelHotelLambda = new Function<CancelHotelRequest, Result>(
      this,
      'cancelHotelLambdaHandler',
      async (event) => {
        console.log('request:', JSON.stringify(event, undefined, 2));

        if (Math.random() < 0.4) {
          throw new Error('Internal Server Error');
        }

        const bookingID =
          typeof event.ReserveHotelResult !== 'undefined'
            ? event.ReserveHotelResult.booking_id
            : '';

        // Call DynamoDB to add the item to the table
        const result = await $AWS.DynamoDB.DeleteItem({
          Table: props.bookingsTable,
          Key: {
            pk: { S: event.reservation.trip_id },
            sk: { S: 'HOTEL#' + bookingID },
          },
        }).catch((error: any) => {
          throw new Error(error);
        });

        console.log('deleted hotel booking:');
        console.log(result);

        // return status of ok
        return { status: 'ok' };
      },
    );

    // 3) Payment For Holiday

    interface TakePaymentResult extends Result {
      payment_id: string;
    }
    interface TakePayloadRequest {
      reservation: Reservation;
      ReserveFlightResult: ReservationResult;
      ReserveHotelResult: ReservationResult;
    }

    // this.createLambda(this,"takePaymentLambdaHandler","payment/takePayment.handler",bookingsTable);
    const takePaymentLambda = new Function<
    TakePayloadRequest,
    TakePaymentResult
    >(this, 'takePaymentLambdaHandler', async (event) => {
      console.log('request:', JSON.stringify(event, undefined, 2));

      const flightBookingID = event.ReserveFlightResult.booking_id;
      const hotelBookingID = event.ReserveHotelResult.booking_id;

      let paymentID = hashCode(
        '' + event.reservation.trip_id + hotelBookingID + flightBookingID,
      );

      // If we passed the parameter to fail this step
      if (event.reservation.run_type === 'failPayment') {
        throw new Error('Failed to book the flights');
      }

      // Call DynamoDB to add the item to the table
      let result = await $AWS.DynamoDB.PutItem({
        Table: props.bookingsTable,
        Item: {
          pk: { S: event.reservation.trip_id },
          sk: { S: 'PAYMENT#' + paymentID },
          type: { S: 'Payment' },
          trip_id: { S: event.reservation.trip_id },
          id: { S: paymentID },
          amount: { S: '450.00' },
          currency: { S: 'USD' },
          transaction_status: { S: 'confirmed' },
        },
      }).catch((error: any) => {
        throw new Error(error);
      });

      console.log('Payment Taken Successfully:');
      console.log(result);

      // return status of ok
      return {
        status: 'ok',
        payment_id: paymentID,
      };
    });

    interface RefundRequest {
      TakePaymentResult?: TakePaymentResult;
      reservation: Reservation;
    }

    // this.createLambda(this,"refundPaymentLambdaHandler","payment/refundPayment.handler",bookingsTable);
    const refundPaymentLambda = new Function<RefundRequest, Result>(
      this,
      'refundPaymentLambdaHandler',
      async (event) => {
        console.log('request:', JSON.stringify(event, undefined, 2));

        if (Math.random() < 0.4) {
          throw new Error('Internal Server Error');
        }

        let paymentID = '';
        if (typeof event.TakePaymentResult !== 'undefined') {
          paymentID = event.TakePaymentResult.payment_id;
        }

        // Call DynamoDB to add the item to the table
        let result = $AWS.DynamoDB.DeleteItem({
          Table: props.bookingsTable,
          Key: {
            pk: { S: event.reservation.trip_id },
            sk: { S: 'PAYMENT#' + paymentID },
          },
        }).catch((error: any) => {
          throw new Error(error);
        });

        console.log('Payment has been refunded:');
        console.log(result);

        // return status of ok
        return {
          status: 'ok',
        };
      },
    );

    new StepFunction(this, 'sagaFunction', async (input: Reservation) => {
      let hotelReservationResult;
      try {
        hotelReservationResult = await reserveHotelLambda(input);
        let flightReservationResult;
        try {
          flightReservationResult = await reserveFlightLambda(input);
          let takePayloadResult;
          try {
            takePayloadResult = await takePaymentLambda({
              reservation: input,
              ReserveFlightResult: flightReservationResult,
              ReserveHotelResult: hotelReservationResult,
            });

            await confirmHotelLambda({
              ReserveHotelResult: hotelReservationResult,
              reservation: input,
            });
            await confirmFlightLambda({
              reservation: input,
              ReserveFlightResult: flightReservationResult,
            });
          } catch {
            // NEED: Retry(3)
            await refundPaymentLambda(
              takePayloadResult
                ? {
                  reservation: input,
                  TakePaymentResult: takePayloadResult,
                }
                : {
                  reservation: input,
                },
            );
            throw Error('Throw to cancel flight.');
          }
        } catch {
          // NEED: Retry(3)
          await cancelFlightLambda(
            flightReservationResult
              ? {
                reservation: input,
                ReserveFlightResult: flightReservationResult,
              }
              : {
                reservation: input,
              },
          );
          throw Error('Throw to cancel hotel.');
        }
      } catch {
        // NEED: Retry(3)
        await cancelHotelLambda(
          hotelReservationResult
            ? {
              reservation: input,
              ReserveHotelResult: hotelReservationResult,
            }
            : { reservation: input },
        );
        throw Error("Sorry, We Couldn't make the booking");
      }

      return 'We have made your booking!';
    });

    function hashCode(s: string) {
      let h: any;

      for (let i = 0; i < s.length; i++) {
        // eslint-disable-next-line no-bitwise
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      }

      return '' + Math.abs(h);
    }
  }
}
