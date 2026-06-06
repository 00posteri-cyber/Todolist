# Timer Scale Slider React Native Plan

## Recommended Stack

- `react-native-reanimated`
- `react-native-gesture-handler`
- `expo-haptics`

## Interaction Model

The center pointer is fixed. The scale track moves horizontally under the pointer.

Selected value is calculated from the tick currently aligned with the center pointer.

## Rules

- Minimum: 5 minutes
- Maximum: 120 minutes
- Step: 5 minutes
- Default: 25 minutes
- Display: `${minutes}:00`
- On release: snap to the nearest 5-minute tick
- Clamp movement within 5-120 minutes

## Expo Haptics

Trigger light selection feedback whenever the selected minute value changes.

```ts
import * as Haptics from "expo-haptics";

Haptics.selectionAsync();
```

## Reanimated Mapping

- Store track offset in a shared value.
- Use `PanGestureHandler` or the Gesture API to update the offset.
- Convert offset to tick index with `Math.round`.
- Clamp index between `0` and `(120 - 5) / 5`.
- Use `withSpring` or `withTiming` to snap the track after release.

## Web Prototype Equivalent

The current browser prototype uses Pointer Events and `navigator.vibrate(8)` to simulate the same interaction and haptic intent.
