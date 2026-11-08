import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { gameStore } from '../dist/game/store.js'

// Operator-assisted check. Only UI counters are sampled. The user supplies the movement.
export async function verifyPhysicalWorkout(ui, db, userId) {
  const store = gameStore(db.prisma)
  const before = await store.profile(userId)
  const started = new Date()
  let sawLandmarks = false
  try {
    await ui.visit('/training?save=1')
    await ui.waitFor('document.querySelector(".training-label")?.textContent.includes("Signed in")')
    await ui.evaluate('[...document.querySelectorAll("label")].find(l=>l.textContent.includes("Auto Start")).querySelector("input").click(); true')
    await ui.evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Enable camera")).click(); true')
    await ui.waitFor('[...document.querySelectorAll("dt")].some(dt=>dt.textContent==="Model" && dt.nextElementSibling.textContent.includes("CPU"))')
    console.log('Physical trial ready. Hold a starting plank for Auto Start, then perform three push-ups.')
    const deadline = Date.now()+300000
    let statusAt = 0
    while (Date.now()<deadline) {
      const reading = await ui.evaluate(`(() => {
        const field = name => [...document.querySelectorAll('dt')].find(dt=>dt.textContent===name)?.nextElementSibling?.textContent
        return { model:field('Model'), landmarks:Number(field('Raw landmarks'))||0, movement:field('Movement'),
          reps:Number(document.querySelector('[data-testid=rep-count]')?.textContent)||0,
          run:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('End session')),
          countdown:document.querySelector('.training-countdown strong')?.textContent }
      })()`)
      sawLandmarks ||= reading.landmarks >= 33
      if (Date.now()>=statusAt) { console.log('Live camera:', JSON.stringify(reading)); statusAt=Date.now()+4500 }
      if (reading.reps>=3 && reading.run) {
        await ui.evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("End session")).click(); true')
        await ui.waitFor('document.querySelector(".training-score")?.textContent.includes("Saved ·")')
        await ui.visit('/profile')
        await ui.waitFor('document.querySelector(".history-row")?.textContent.includes("Solo training")')
        const p = await store.profile(userId), entry = p.history[0]
        assert.ok(sawLandmarks && entry.activity.kind==='solo' && entry.score===reading.reps)
        const bonus=entry.score>=5 && !before.dailyComplete
        assert.equal(p.xp-before.xp,5*entry.score+(bonus?15:0))
        assert.equal(p.crystals-before.crystals,Math.floor(entry.score/3)+(bonus?2:0))
        assert.equal(p.workouts-before.workouts,1)
        assert.equal(await db.prisma.reward.count({where:{userId,source:entry.activity.id}}),1)
        console.log('Android human camera workout verified:', JSON.stringify({score:entry.score, xp:p.xp-before.xp, crystals:p.crystals-before.crystals, model:reading.model}))
        return
      }
      await delay(400)
    }
    throw Error('Physical trial did not reach the target before timeout')
  } finally {
    await ui.visit('/account')
    const ownSolo = await db.prisma.activityPlayer.findMany({where:{userId,activity:{kind:'solo',startedAt:{gte:started}}},select:{activityId:true}})
    await db.prisma.activity.deleteMany({where:{id:{in:ownSolo.map(r=>r.activityId)}}})
  }
}
