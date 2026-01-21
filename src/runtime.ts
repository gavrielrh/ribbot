import { Effect, Layer, Logger, LogLevel, ManagedRuntime, Schedule, Duration, Fiber } from "effect";
import { ShopifyClientLive, TeaStoreLive, UserTeaServiceLive, TeaStore } from "./services/index.ts";

const ServicesLive = TeaStoreLive.pipe(
  Layer.provideMerge(ShopifyClientLive),
  Layer.provideMerge(UserTeaServiceLive),
);

const LoggingLive = Logger.minimumLogLevel(LogLevel.Info);

export const AppLive = ServicesLive.pipe(
  Layer.provide(LoggingLive),
);

export const AppRuntime = ManagedRuntime.make(AppLive);

const refreshSchedule = Schedule.fixed(Duration.hours(1));

export const startScheduledRefresh = Effect.gen(function* () {
  const teaStore = yield* TeaStore;

  const refreshProgram = Effect.gen(function* () {
    yield* Effect.logInfo("Starting scheduled tea refresh...");
    const teas = yield* teaStore.refreshTeas().pipe(
      Effect.catchAll((error) => {
        return Effect.logError(`Failed to refresh teas: ${error}`).pipe(
          Effect.flatMap(() => Effect.succeed([] as const))
        );
      })
    );
    yield* Effect.logInfo(`Scheduled refresh complete: ${teas.length} teas`);
  });

  const fiber = yield* refreshProgram.pipe(
    Effect.repeat(refreshSchedule),
    Effect.fork,
  );

  yield* Effect.logInfo("Scheduled tea refresh started (every 1 hour)");

  return fiber;
});

export const runEffect = <A, E>(effect: Effect.Effect<A, E, never>) =>
  AppRuntime.runPromise(effect);

export const runWithServices = <A, E>(
  effect: Effect.Effect<A, E, TeaStore>,
) => AppRuntime.runPromise(effect);
