import { ShaderMaterial, Vector2, Color } from 'three';

export const TECHNICAL_SETTINGS = Object.freeze({
  visibleLineOpacity: 0.9, hiddenLineOpacity: 0.16, lineThickness: 1.15,
  normalThreshold: 0.32, depthThreshold: 0.006, componentBoundaryStrength: 0.85,
  background: '#0b1017', lineColor: '#e0e9f0', maxPixelRatio: 1.5,
  maxPixels: 1600000, mobileMaxPixels: 650000, maxHiddenComponents: 32, mobileHiddenComponents: 12
});

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const edges = `
  varying vec2 vUv;
  uniform sampler2D normals, depths, ids, fullDepth, hiddenLines;
  uniform vec2 texel;
  uniform float nearPlane, farPlane, thickness, normalThreshold, depthThreshold, boundaryStrength;
  uniform float selectedId, hoverId, visibleOpacity, hiddenOpacity, componentId;
  uniform vec3 background, lineColor;
  float viewDepth(float d){return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
  float partAt(vec2 uv){vec3 c=floor(texture2D(ids,uv).rgb*255.+.5);return dot(c,vec3(1.,256.,65536.));}
  float matched(float a,float b){return (a>0. && abs(a-b)<.5)?1.:0.;}
  // Second depth difference rejects the ordinary depth slope of a continuous plane.
  // Normals and semantic IDs supply creases/boundaries without mesh triangulation.
  vec3 edgeAt(vec2 uv, bool useIds){
    float d=texture2D(depths,uv).r;
    float z=viewDepth(d);
    vec3 n=texture2D(normals,uv).xyz*2.-1.;
    float id=useIds?partAt(uv):componentId;
    float edge=0., selected=matched(id,selectedId), hovered=matched(id,hoverId);
    for(int axis=0;axis<4;axis++){
      vec2 direction=axis==0?vec2(1.,0.):axis==1?vec2(0.,1.):axis==2?vec2(.707,.707):vec2(.707,-.707);
      vec2 stepUV=direction*texel*thickness;
      vec2 a=uv+stepUV,b=uv-stepUV;
      float da=texture2D(depths,a).r,db=texture2D(depths,b).r;
      float silhouette=max(abs(step(.99999,d)-step(.99999,da)),abs(step(.99999,d)-step(.99999,db)));
      float discontinuity=abs(viewDepth(da)+viewDepth(db)-2.*z)/max(z,.01);
      float depthEdge=smoothstep(depthThreshold,depthThreshold*2.,discontinuity);
      float normalEdge=0.;
      if(d<.99999 && da<.99999 && db<.99999){
        vec3 na=texture2D(normals,a).xyz*2.-1.,nb=texture2D(normals,b).xyz*2.-1.;
        normalEdge=smoothstep(normalThreshold,normalThreshold*1.6,max(length(n-na),length(n-nb)));
      }
      float boundary=0.;
      if(useIds){float ia=partAt(a),ib=partAt(b);boundary=max(step(.5,abs(id-ia)),step(.5,abs(id-ib)))*boundaryStrength;
        selected=max(selected,max(matched(ia,selectedId),matched(ib,selectedId)));
        hovered=max(hovered,max(matched(ia,hoverId),matched(ib,hoverId)));}
      edge=max(edge,max(silhouette,max(depthEdge,max(normalEdge,boundary))));
    }
    return vec3(edge,selected,hovered);
  }
`;

export function createEdgeMaterial(settings, hidden = false) {
  return new ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      normals: { value: null }, depths: { value: null }, ids: { value: null }, fullDepth: { value: null }, hiddenLines: { value: null },
      texel: { value: new Vector2(1,1) }, nearPlane: { value: .05 }, farPlane: { value: 100 },
      thickness: { value: settings.lineThickness }, normalThreshold: { value: settings.normalThreshold },
      depthThreshold: { value: settings.depthThreshold }, boundaryStrength: { value: settings.componentBoundaryStrength },
      selectedId: { value: 0 }, hoverId: { value: 0 }, componentId: { value: 0 },
      visibleOpacity: { value: settings.visibleLineOpacity }, hiddenOpacity: { value: settings.hiddenLineOpacity },
      background: { value: new Color(settings.background) }, lineColor: { value: new Color(settings.lineColor) }
    }, vertexShader, fragmentShader: edges + (hidden ? `
      void main(){float d=texture2D(depths,vUv).r,full=texture2D(fullDepth,vUv).r;
        float obscured=(d<.99999 && viewDepth(d)>viewDepth(full)+.003)?1.:0.;
        float emphasis=selectedId>0.?mix(.28,1.,matched(componentId,selectedId)):1.;
        float edge=edgeAt(vUv,false).x*obscured*emphasis;
        gl_FragColor=vec4(vec3(edge),1.);
      }` : `
      void main(){vec3 edge=edgeAt(vUv,true);
        float emphasis=selectedId>0.?mix(.22,1.,edge.y):1.;
        float strength=clamp(edge.x*(visibleOpacity+edge.y*.1+edge.z*.1)*emphasis,0.,1.);
        float hidden=texture2D(hiddenLines,vUv).r*hiddenOpacity;
        gl_FragColor=vec4(mix(background,lineColor,max(strength,hidden)),1.);
        #include <colorspace_fragment>
      }`)
  });
}
