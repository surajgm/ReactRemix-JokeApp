import bcrypt from "bcrypt";
import {
    createCookieSessionStorage,
    redirect
  } from "remix";
import { db } from "./db.server";

type LoginType = {
  username: string;
  password: string;
};

export async function register({username, password}: LoginType) {
   const passwordHash = await bcrypt.hash(password, 10);
   const user = await db.user.create({
     data: {
       username, passwordHash
     }
   });
   return user;
}

export async function login({
  username,
  password
}: LoginType) {
  let user = await db.user.findUnique({
    where: { username }
  });
  if (!user) return null;

  let isCorrectPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );
  if (!isCorrectPassword) return null;

  return user;
}   

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

let storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true
  }
});

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  let session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session)
    }
  });
}

function getUserSession(request: Request){
    return storage.getSession(request.headers.get('Cookie')) 
}

export async function getUserId(request: Request) {
    let session = await getUserSession(request);
    let userId = session.get("userId");
    if(typeof userId !== "string"){
        return null
    }
    return userId
}

export async function requireUserId(request: Request, redirectTo: string = new URL(request.url).pathname) {
  let userId = await getUserId(request);
  if(!userId) {
    let params = new URLSearchParams([["redirectTo", redirectTo]])
    throw redirect(`/login?${params}`);
  }
  return userId;
}

export async function getUser(request: Request) {
  let userId = await getUserId(request);
  if(!userId) return null;
  return db.user.findUnique({where: {id: userId}});
}

export async function logout(request: Request) {
  let session = await getUserSession(request);
  return redirect(`/jokes`, {
    headers: {
      "Set-Cookie" : await storage.destroySession(session),
    },
  });
}