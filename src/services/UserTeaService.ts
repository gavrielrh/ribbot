import { Context, Effect, Layer, Option } from "effect";
import PocketBase from "pocketbase";
import { PocketBaseError } from "../errors.ts";
import { pocketbaseUrl, pocketbaseUsername, pocketbasePassword } from "../config.ts";

/** A user's preference record for a specific tea. */
export type UserTea = {
  id: string;
  user_snowflake: string;
  tea_title: string;
  status: "like" | "dislike";
};

const escapeString = (s: string) => s.replaceAll('"', '\\"');
const unescapeString = (s: string) => s.replaceAll('\\"', '"');

/**
 * Service for managing user tea preferences (favorites/dislikes).
 * Persists data to PocketBase.
 */
export class UserTeaService extends Context.Tag("UserTeaService")<
  UserTeaService,
  {
    /** Gets a user's preference for a specific tea. */
    getUserTea: (params: {
      user_snowflake: string;
      tea_title: string;
    }) => Effect.Effect<Option.Option<UserTea>, PocketBaseError>;
    /** Gets all tea titles a user has favorited. */
    getFavoriteTeas: (params: {
      user_snowflake: string;
    }) => Effect.Effect<string[], PocketBaseError>;
    /** Gets all tea titles a user has disliked. */
    getDislikedTeas: (params: {
      user_snowflake: string;
    }) => Effect.Effect<string[], PocketBaseError>;
    /** Checks if a user has favorited a specific tea. */
    isFavoriteTea: (params: {
      user_snowflake: string;
      tea_title: string;
    }) => Effect.Effect<boolean, PocketBaseError>;
    /** Checks if a user has disliked a specific tea. */
    isDislikedTea: (params: {
      user_snowflake: string;
      tea_title: string;
    }) => Effect.Effect<boolean, PocketBaseError>;
    /** Marks a tea as favorited for a user. */
    setFavoriteTea: (params: {
      user_snowflake: string;
      tea_title: string;
    }) => Effect.Effect<void, PocketBaseError>;
    /** Marks a tea as disliked for a user. */
    setDislikedTea: (params: {
      user_snowflake: string;
      tea_title: string;
    }) => Effect.Effect<void, PocketBaseError>;
    /** Removes any preference (like/dislike) for a tea. */
    clearTeaStatus: (params: {
      user_snowflake: string;
      tea_title: string;
    }) => Effect.Effect<void, PocketBaseError>;
  }
>() {}

export const UserTeaServiceLive = Layer.effect(
  UserTeaService,
  Effect.gen(function* () {
    const pb = new PocketBase(pocketbaseUrl);

    // Authenticate on service creation
    yield* Effect.tryPromise({
      try: () =>
        pb.collection("users").authWithPassword(
          pocketbaseUsername,
          pocketbasePassword,
        ),
      catch: (error) =>
        new PocketBaseError({
          message: String(error),
          operation: "authWithPassword",
        }),
    });

    yield* Effect.logInfo("PocketBase authenticated");

    const getUserTeaImpl = ({
      user_snowflake,
      tea_title,
    }: {
      user_snowflake: string;
      tea_title: string;
    }): Effect.Effect<Option.Option<UserTea>, PocketBaseError> =>
      Effect.tryPromise({
        try: async () => {
          const record = (await pb.collection("user_teas").getFirstListItem(
            `user_snowflake="${user_snowflake}" && tea_title="${escapeString(tea_title)}"`,
          )) as UserTea;
          record.tea_title = unescapeString(tea_title);
          return Option.some(record);
        },
        catch: () => Option.none<UserTea>(),
      }).pipe(Effect.catchAll(() => Effect.succeed(Option.none<UserTea>())));

    const setUserTeaStatus = ({
      user_snowflake,
      tea_title,
      status,
    }: {
      user_snowflake: string;
      tea_title: string;
      status: "like" | "dislike";
    }): Effect.Effect<void, PocketBaseError> =>
      Effect.gen(function* () {
        const userTeaOption = yield* getUserTeaImpl({ user_snowflake, tea_title });
        if (Option.isSome(userTeaOption)) {
          yield* Effect.tryPromise({
            try: () =>
              pb.collection("user_teas").update(userTeaOption.value.id, { status }),
            catch: (error) =>
              new PocketBaseError({
                message: String(error),
                operation: "updateUserTeaStatus",
              }),
          });
        } else {
          yield* Effect.tryPromise({
            try: () =>
              pb.collection("user_teas").create({
                user_snowflake,
                tea_title,
                status,
              }),
            catch: (error) =>
              new PocketBaseError({
                message: String(error),
                operation: "createUserTea",
              }),
          });
        }
        yield* Effect.logDebug(`Set tea status: ${tea_title} -> ${status}`);
      });

    return {
      getUserTea: getUserTeaImpl,

      getFavoriteTeas: ({ user_snowflake }) =>
        Effect.tryPromise({
          try: async () => {
            const records = await pb.collection("user_teas").getFullList({
              filter: `user_snowflake = "${user_snowflake}" && status="like"`,
            });
            return records.map((record) =>
              unescapeString((record as unknown as { tea_title: string }).tea_title)
            );
          },
          catch: (error) =>
            new PocketBaseError({
              message: String(error),
              operation: "getFavoriteTeas",
            }),
        }),

      getDislikedTeas: ({ user_snowflake }) =>
        Effect.tryPromise({
          try: async () => {
            const records = await pb.collection("user_teas").getFullList({
              filter: `user_snowflake = "${user_snowflake}" && status="dislike"`,
            });
            return records.map((record) =>
              unescapeString((record as unknown as { tea_title: string }).tea_title)
            );
          },
          catch: (error) =>
            new PocketBaseError({
              message: String(error),
              operation: "getDislikedTeas",
            }),
        }),

      isFavoriteTea: ({ user_snowflake, tea_title }) =>
        Effect.gen(function* () {
          const userTeaOption = yield* getUserTeaImpl({ user_snowflake, tea_title });
          return Option.isSome(userTeaOption) && userTeaOption.value.status === "like";
        }),

      isDislikedTea: ({ user_snowflake, tea_title }) =>
        Effect.gen(function* () {
          const userTeaOption = yield* getUserTeaImpl({ user_snowflake, tea_title });
          return Option.isSome(userTeaOption) && userTeaOption.value.status === "dislike";
        }),

      setFavoriteTea: ({ user_snowflake, tea_title }) =>
        setUserTeaStatus({ user_snowflake, tea_title, status: "like" }),

      setDislikedTea: ({ user_snowflake, tea_title }) =>
        setUserTeaStatus({ user_snowflake, tea_title, status: "dislike" }),

      clearTeaStatus: ({ user_snowflake, tea_title }) =>
        Effect.gen(function* () {
          const userTeaOption = yield* getUserTeaImpl({ user_snowflake, tea_title });
          if (Option.isSome(userTeaOption)) {
            yield* Effect.tryPromise({
              try: () => pb.collection("user_teas").delete(userTeaOption.value.id),
              catch: (error) =>
                new PocketBaseError({
                  message: String(error),
                  operation: "clearTeaStatus",
                }),
            });
            yield* Effect.logDebug(`Cleared tea status: ${tea_title}`);
          }
        }),
    };
  }),
);
