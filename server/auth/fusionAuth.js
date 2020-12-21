// @flow
import addHours from "date-fns/add_hours";
import Router from "koa-router";
import Sequelize, { Promise } from "sequelize";

import * as FusionAuth from "../fusionAuth";
import auth from "../middlewares/authentication";
import { User, Team, Event } from "../models";
import { getCookieDomain } from "../utils/domains";

const Op = Sequelize.Op;
const router = new Router();

// start the oauth process and redirect user to FusionAuth
router.get("fusionauth", async (ctx) => {
  const state = Math.random().toString(36).substring(7);

  ctx.cookies.set("state", state, {
    httpOnly: false,
    expires: addHours(new Date(), 1),
    domain: getCookieDomain(ctx.request.hostname),
  });
  const authorizeUrl = FusionAuth.generateAuthorizeUrl(state);
  ctx.redirect(authorizeUrl);
});

// signin callback from FusionAuth
router.get("fusionauth.callback", auth({ required: false }), async (ctx) => {
  const { code, error, state } = ctx.request.query;
  ctx.assertPresent(code || error, "code is required");
  ctx.assertPresent(state, "state is required");

  if (state !== ctx.cookies.get("state")) {
    ctx.redirect("/?notice=auth-error&error=state_mismatch");
    return;
  }
  if (error) {
    ctx.redirect(`/?notice=auth-error&error=${error}`);
    return;
  }

  const data = await FusionAuth.exchangeOAuthCodeForAccessToken(code);

  if (!data.wasSuccessful) {
    ctx.redirect(`/?notice=auth-error&error=${data.exception.message}`);
    return;
  }

  const retrieveUserResponse = await FusionAuth.retrieveUser(
    data.response.userId
  );

  const userData = retrieveUserResponse.response.user;

  const [team, isFirstUser] = await Team.findOrCreate({
    where: {
      fusionauthId: FusionAuth.tenantId,
    },
    defaults: {
      name: FusionAuth.teamName,
      avatarUrl: FusionAuth.teamImageUrl,
    },
  });

  try {
    const [user, isFirstSignin] = await User.findOrCreate({
      where: {
        [Op.or]: [
          {
            service: "fusionauth",
            serviceId: userData.id,
          },
          {
            service: { [Op.eq]: null },
            email: userData.email,
          },
        ],
        teamId: team.id,
      },
      defaults: {
        service: "fusionauth",
        serviceId: userData.id,
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        isAdmin: isFirstUser,
        avatarUrl: userData.imageUrl,
        language: "pt_BR",
      },
    });

    // update the user with fresh details if they just accepted an invite
    if (!user.serviceId || !user.service) {
      await user.update({
        service: "fusionauth",
        serviceId: userData.id,
        avatarUrl: userData.imageUrl,
      });
    }

    // update email address if it's changed in Slack
    if (!isFirstSignin && userData.email !== user.email) {
      await user.update({ email: userData.email });
    }

    if (isFirstUser) {
      await team.provisionFirstCollection(user.id);
      await team.provisionSubdomain(FusionAuth.teamName);
    }

    // set cookies on response and redirect to team subdomain
    ctx.signIn(user, team, "fusionauth", isFirstSignin);
  } catch (err) {
    if (err instanceof Sequelize.UniqueConstraintError) {
      const exists = await User.findOne({
        where: {
          service: "email",
          email: userData.email,
          teamId: team.id,
        },
      });

      if (exists) {
        ctx.redirect(`${team.url}?notice=email-auth-required`);
      } else {
        ctx.redirect(`${team.url}?notice=auth-error`);
      }

      return;
    }

    throw err;
  }
});

router.post("fusionauth.hooks", async (ctx) => {
  const secret = ctx.header["x-fusionauth-hook-secret"];
  const event = ctx.body["event"];
  if (secret === FusionAuth.hookSecret) {
    if ("type" in event && event.type === "user.create") {
      await FusionAuth.registerUser(event.user.id);
    } else if ("type" in event && event.type === "user.delete") {
      const users = await User.findAll({
        where: {
          email: event.user.email,
        },
      });
      users.map(async (user) => {
        try {
          await user.destroy();
          await Event.create({
            name: "users.delete",
            actorId: user.id,
            userId: user.id,
            teamId: user.teamId,
            data: { name: user.name },
            ip: ctx.request.ip,
          });
        } catch (e) {}
      });
    }
  }
});

export default router;
