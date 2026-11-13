// One mutable object shared by the controls and the existing render loop.
export const parameters = { chaos:35, speed:40, distortion:35, color:50 };
export function randomizeVisuals(state, styleNames, random=Math.random) {
  for(const name of ['chaos','speed','distortion','color'])state[name]=Math.floor(random()*101);
  return styleNames[Math.floor(random()*styleNames.length)];
}
// Visual-only adapter; future audio mapping should be a separate consumer.
export function visualParameters(state=parameters){return {chaos:state.chaos/100,speed:.1+state.speed*.0225,distortion:state.distortion/100,hueShift:(state.color-50)*3.6};}
