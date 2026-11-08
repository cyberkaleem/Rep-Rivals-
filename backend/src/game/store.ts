import type { PrismaClient } from "../generated/prisma/client.js"

export type Outcome = "solo" | "win" | "loss" | "draw"
export type Outfit = "ember" | "tide" | "violet"
export interface ResultPlayer {
  id: string
  offsets: number[]
  outcome: Outcome
}
export interface ActivityResult {
  id: string
  kind: "battle" | "solo"
  starts: number
  ends: number
  players: ResultPlayer[]
}

export function award(count: number, outcome: Outcome) {
  return {
    xp: count * 5 + (count && outcome === "win" ? 25 : 0),
    crystals: Math.floor(count / 3) + (count && outcome === "win" ? 3 : 0),
  }
}
const dailyKey = (type: "five" | "duel", time: number) =>
  type + ":" + new Date(time).toISOString().slice(0, 10)
export function rank(xp: number) {
  if (xp >= 1500) return { name: "Titan", floor: 1500, next: null }
  if (xp >= 300) return { name: "Elite", floor: 300, next: 1500 }
  return { name: "Noob", floor: 0, next: 300 }
}

export function gameStore(db: PrismaClient) {
  return {
    async finish(result: ActivityResult) {
      await db.$transaction(
        async (tx) => {
          const inserted = await tx.activity.createMany({
            skipDuplicates: true,
            data: [
              {
                id: result.id,
                kind: result.kind,
                startedAt: new Date(result.starts),
                finishedAt: new Date(result.ends),
              },
            ],
          })
          if (!inserted.count) return
          for (const player of result.players) {
            const userId = player.id,
              score = player.offsets.length
            await tx.activityPlayer.create({
              data: {
                userId,
                activityId: result.id,
                acceptedAtMs: player.offsets,
                score,
                outcome: player.outcome,
              },
            })
            if (!score) continue
            const rewards = [
              { userId, source: result.id, ...award(score, player.outcome) },
            ]
            if (score >= 5)
              rewards.push({
                userId,
                source: dailyKey("five", result.ends),
                xp: 15,
                crystals: 2,
              })
            if (result.kind === "battle")
              rewards.push({
                userId,
                source: dailyKey("duel", result.ends),
                xp: 10,
                crystals: 1,
              })
            await tx.reward.createMany({ data: rewards, skipDuplicates: true })
          }
        },
        { timeout: 20000 },
      )
    },
    async outfit(userId: string, outfit: Outfit) {
      await db.playerProfile.upsert({
        where: { userId },
        create: { userId, outfit },
        update: { outfit },
      })
    },
    async profile(userId: string) {
      const stats = db.activityPlayer.groupBy({
        by: ["outcome"],
        where: { userId },
        _count: true,
        _sum: { score: true },
      })
      const [user, totals, groups, results, daily] = await db.$transaction([
        db.user.findUniqueOrThrow({
          where: { id: userId },
          select: { username: true, profile: true },
        }),
        db.reward.aggregate({
          where: { userId },
          _sum: { xp: true, crystals: true },
        }),
        stats,
        db.activityPlayer.findMany({
          where: { userId },
          orderBy: { activity: { finishedAt: "desc" } },
          take: 25,
          select: {
            outcome: true,
            score: true,
            activity: {
              select: {
                id: true,
                kind: true,
                startedAt: true,
                finishedAt: true,
                players: {
                  select: { user: { select: { username: true } }, score: true },
                },
              },
            },
          },
        }),
        db.reward.findMany({
          where: {
            userId,
            source: {
              in: [dailyKey("five", Date.now()), dailyKey("duel", Date.now())],
            },
          },
          select: { source: true },
        }),
      ])
      const xp = totals._sum.xp ?? 0
      const count = (outcome: Outcome) =>
        groups.find((g) => g.outcome === outcome)?._count ?? 0
      return {
        id: userId,
        username: user.username,
        outfit: user.profile?.outfit ?? "ember",
        xp,
        crystals: totals._sum.crystals ?? 0,
        rank: rank(xp),
        reps: groups.reduce((n, g) => n + (g._sum.score ?? 0), 0),
        workouts: count("solo"),
        wins: count("win"),
        losses: count("loss"),
        draws: count("draw"),
        history: results,
        dailyComplete: daily.some((r) => r.source.startsWith("five:")),
        dailyBattle: daily.some((r) => r.source.startsWith("duel:")),
      }
    },
  }
}
export type GameStore = ReturnType<typeof gameStore>
