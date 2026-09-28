# Follow requirement (opt-in beta)

Rules can require a follow before releasing their DM. Existing rules default off.
The initial comment private reply contains a follow request and an "I've followed"
postback button. A recipient may also reply DONE. Following alone is not a trigger.

After a recent messaging interaction, the server reads Meta's
`is_user_follow_business` field. Only an explicit true releases the saved offer.
Unknown/failed checks keep the offer locked and log an activity event. No follower
counts, scraping, or self-reported follows are used as verification.

## Setup and validation

1. Deploy the Prisma migration before the new backend starts.
2. In the Meta app's Instagram webhook configuration, enable `messages` and
   `messaging_postbacks` alongside `comments` and `live_comments`, using the
   existing callback URL and verify token. Keep webhook signature verification.
3. Saving a rule with the follow requirement subscribes its connected account to
   those fields. The existing `instagram_business_manage_messages` permission
   must have appropriate access for the account.
4. Test with a separate non-follower: comment, receive the opening button, tap
   before following (no offer), follow, wait at least 10 seconds and tap again.
   Confirm one offer, branding, and activity "Follow verified — offer sent".
5. Confirm repeated taps do not release another offer. Test DONE as an alternative
   and verify an ordinary ungated rule still sends its normal private reply.

Each outgoing opening, reminder, or offer uses one monthly DM. An exhausted quota
keeps the offer locked. The gate accepts interactions for seven days after the
initial comment; each accepted interaction must be less than 23 hours old.
Ambiguous outbound failures are held for review to avoid duplicate delivery.
Review the Instagram conversation before manually resending in that case.

This is not the Meta new-follower beta trigger. Button/private reply availability,
profile consent and real-account permissions still require the live test above.
