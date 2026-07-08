import type { Racha } from './types'

// finalizado manualmente pelo organizador OU o DIA do racha já passou (ignora
// o horário — não temos hora de término, então um racha de hoje nunca conta
// como finalizado sozinho, só a partir do dia seguinte ou marcação manual)
export function rachaFinalizado(racha: Racha): boolean {
  if (racha.finalizado) return true

  const hoje = new Date()
  const dataRacha = new Date(racha.data_hora)
  const hojeSoData = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const rachaSoData = new Date(dataRacha.getFullYear(), dataRacha.getMonth(), dataRacha.getDate())

  return rachaSoData < hojeSoData
}
