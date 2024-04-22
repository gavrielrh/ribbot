import { pb } from "./store.ts";
// get favorite teas
// get disliked teas
// is favorite tea
// is disliked tea
// favorite tea
// dislike tea

export type UserTea = {
  id: string;
  user_snowflake: string;
  tea_title: string;
  status: "like" | "dislike";
};

const escapeString = (s: string) => s.replaceAll('"', '\\"');
const unescapeString = (s: string) => s.replaceAll('\\"', '"');

export const getUserTea = async (
  { user_snowflake, tea_title }: { user_snowflake: string; tea_title: string },
): Promise<UserTea | undefined> => {
  try {
    const record = (await pb.collection("user_teas").getFirstListItem(
      `user_snowflake="${user_snowflake}" && tea_title="${
        escapeString(tea_title)
      }"`,
    )) as UserTea;
    record.tea_title = unescapeString(tea_title);
    return record;
  } catch (_error) {
    return undefined;
  }
};

export const getFavoriteTeas = async (
  { user_snowflake }: { user_snowflake: string },
): Promise<string[]> => {
  return (await pb.collection("user_teas").getFullList({
    filter: `user_snowflake = "${user_snowflake}" && status="like"`,
  })).map((record: any) => unescapeString(record.tea_title));
};

export const getDislikedTeas = async (
  { user_snowflake }: { user_snowflake: string },
): Promise<string[]> => {
  return (await pb.collection("user_teas").getFullList({
    filter: `user_snowflake = "${user_snowflake}" && status="dislike"`,
  })).map((record: any) => unescapeString(record.tea_title));
};

export const isFavoriteTea = async (
  { user_snowflake, tea_title }: { user_snowflake: string; tea_title: string },
) => {
  const userTea = await getUserTea({ user_snowflake, tea_title });
  return userTea?.status === "like";
};

export const isDislikedTea = async (
  { user_snowflake, tea_title }: { user_snowflake: string; tea_title: string },
) => {
  const userTea = await getUserTea({ user_snowflake, tea_title });
  return userTea?.status === "dislike";
};

export const setUserTeaStatus = async (
  { user_snowflake, tea_title, status }: {
    user_snowflake: string;
    tea_title: string;
    status: "like" | "dislike";
  },
) => {
  const userTea = await getUserTea({ user_snowflake, tea_title });
  if (userTea) {
    await pb.collection("user_teas").update(userTea.id, { status });
  } else {
    await pb.collection("user_teas").create({
      user_snowflake,
      tea_title,
      status,
    });
  }
};

export const setFavoriteTea = async (
  { user_snowflake, tea_title }: { user_snowflake: string; tea_title: string },
) => {
  await setUserTeaStatus({ user_snowflake, tea_title, status: "like" });
};

export const setDislikedTea = async (
  { user_snowflake, tea_title }: { user_snowflake: string; tea_title: string },
) => {
  await setUserTeaStatus({ user_snowflake, tea_title, status: "dislike" });
};

export const clearTeaStatus = async (
  { user_snowflake, tea_title }: { user_snowflake: string; tea_title: string },
) => {
  const userTea = await getUserTea({ user_snowflake, tea_title });
  if (userTea) {
    await pb.collection("user_teas").delete(userTea.id);
  }
};
