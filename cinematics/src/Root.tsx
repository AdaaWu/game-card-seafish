import { Composition } from 'remotion'
import { Opening, OPENING_DURATION } from './Opening'

export const Root = () => (
  <Composition id="Opening" component={Opening} durationInFrames={OPENING_DURATION} fps={30} width={1920} height={1080} />
)
