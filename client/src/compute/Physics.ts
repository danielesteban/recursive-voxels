import type { vec3 } from 'gl-matrix';
import initJolt from 'jolt-physics/wasm';
import joltWasmUrl from "jolt-physics/jolt-physics.wasm.wasm?url";

export enum PhysicsLayer {
  static,
  dynamic,
}

type PhysicsShape = (
  {
    type: 'sphere';
    radius: number;
  }
  | {
    type: 'voxels',
    boxes: Uint16Array;
  }
);

export class Physics {
  static async create() {
    const Jolt = await initJolt({
      locateFile: () => joltWasmUrl,
    });
    return new Physics(Jolt);
  }

  private readonly Jolt: typeof initJolt;
  private readonly jolt: initJolt.JoltInterface;
  private readonly bodyInterface: initJolt.BodyInterface;
  private readonly contactListener: initJolt.ContactListenerJS;
  private readonly physicsSystem: initJolt.PhysicsSystem;
  private onContact?: (
    body1: initJolt.Body,
    body2: initJolt.Body,
    impluses: initJolt.ContactImpulses,
    manifold: initJolt.ContactManifold,
    settings: initJolt.ContactSettings
  ) => void;

  constructor(Jolt: typeof initJolt) {
    this.Jolt = Jolt;

    const settings = new Jolt.JoltSettings();
    settings.mMaxWorkerThreads = 3;
    {
      const NUM_LAYERS = 2;
      const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_LAYERS);
      objectFilter.EnableCollision(PhysicsLayer.static, PhysicsLayer.dynamic);
      objectFilter.EnableCollision(PhysicsLayer.dynamic, PhysicsLayer.dynamic);

      const BP_LAYER_STATIC = new Jolt.BroadPhaseLayer(PhysicsLayer.static);
      const BP_LAYER_DYNAMIC = new Jolt.BroadPhaseLayer(PhysicsLayer.dynamic);
      const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_LAYERS, NUM_LAYERS);
      bpInterface.MapObjectToBroadPhaseLayer(PhysicsLayer.static, BP_LAYER_STATIC);
      bpInterface.MapObjectToBroadPhaseLayer(PhysicsLayer.dynamic, BP_LAYER_DYNAMIC);

      settings.mObjectLayerPairFilter = objectFilter;
      settings.mBroadPhaseLayerInterface = bpInterface;
      settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(settings.mBroadPhaseLayerInterface, NUM_LAYERS, settings.mObjectLayerPairFilter, NUM_LAYERS);
    }

    this.jolt = new Jolt.JoltInterface(settings);
    Jolt.destroy(settings);
    this.physicsSystem = this.jolt.GetPhysicsSystem();
    this.bodyInterface = this.physicsSystem.GetBodyInterface();

    this.contactListener = new Jolt.ContactListenerJS();
    this.contactListener.OnContactAdded = this.onContactAdded.bind(this);
    this.contactListener.OnContactPersisted = this.contactListener.OnContactAdded;
    this.contactListener.OnContactValidate = this.onContactValidate.bind(this);
    this.contactListener.OnContactRemoved = this.onContactRemoved.bind(this);
    this.physicsSystem.SetContactListener(this.contactListener);
  }

  private onContactAdded(body1P: number, body2P: number, manifoldP: number, settingsP: number) {
    const { Jolt, onContact } = this;
    const body1 = Jolt.wrapPointer(body1P, Jolt.Body);
    const body2 = Jolt.wrapPointer(body2P, Jolt.Body);
    const manifold = Jolt.wrapPointer(manifoldP, Jolt.ContactManifold);
    const settings = Jolt.wrapPointer(settingsP, Jolt.ContactSettings);
    const collisionEstimate = new Jolt.CollisionEstimationResult();
    Jolt.JoltInterface.prototype.sEstimateCollisionResponse(body1, body2, manifold, collisionEstimate, settings);
    onContact?.(
      Jolt.wrapPointer(body1P, Jolt.Body),
      Jolt.wrapPointer(body2P, Jolt.Body),
      collisionEstimate.mContactImpulse,
      Jolt.wrapPointer(manifoldP, Jolt.ContactManifold),
      Jolt.wrapPointer(settingsP, Jolt.ContactSettings),
    );
    Jolt.destroy(collisionEstimate);
  }

  private onContactValidate(_body1: number, _body2: number, _baseOffset: number, _collideShapeResult: number) {
    const { Jolt } = this;
    return Jolt.ValidateResult_AcceptAllContactsForThisBodyPair;
  }

  private onContactRemoved(_subShapePair: number) {

  }

  getShape(shape: PhysicsShape) {
    const { Jolt } = this;
    let shp: initJolt.Shape;
    switch (shape.type) {
      case 'sphere':
        shp = new Jolt.SphereShape(shape.radius);
        break;
      case 'voxels': {
        const compound = new Jolt.StaticCompoundShapeSettings();
        const pos = new Jolt.Vec3();
        const size = new Jolt.Vec3();
        for (let i = 0, l = shape.boxes.length; i < l; i += 6) {
          size.Set(shape.boxes[i + 3] * 0.5, shape.boxes[i + 4] * 0.5, shape.boxes[i + 5] * 0.5);
          pos.Set(shape.boxes[i] + size.GetX(), shape.boxes[i + 1] + size.GetY(), shape.boxes[i + 2] + size.GetZ());
          const box = new Jolt.BoxShapeSettings(size);
          compound.AddShape(pos, Jolt.Quat.prototype.sIdentity(), box, 0);
        }
        Jolt.destroy(pos);
        Jolt.destroy(size);
        const shapeResult = compound.Create();
        shp = shapeResult.Get();
        shapeResult.Clear();
        shp.AddRef();
        Jolt.destroy(compound);
        break;
      }
    }
    return shp;
  }

  addBody({
    allowSleeping = true,
    allowRotation = true,
    gravityFactor = 1,
    layer,
    mass,
    position,
    shape,
  }: {
    allowRotation?: boolean;
    allowSleeping?: boolean;
    gravityFactor?: number;
    layer: PhysicsLayer;
    mass?: number;
    position: vec3;
    shape: initJolt.Shape;
  }) {
    const { bodyInterface, Jolt } = this;
    const pos = new Jolt.RVec3(position[0], position[1], position[2]);
    const creationSettings = new Jolt.BodyCreationSettings(
      shape,
      pos,
      Jolt.Quat.prototype.sIdentity(),
      layer === PhysicsLayer.static ? Jolt.EMotionType_Static : Jolt.EMotionType_Dynamic,
      layer
    );
    Jolt.destroy(pos);
    if (!allowRotation) {
      creationSettings.mAllowedDOFs = (
        Jolt.EAllowedDOFs_TranslationX
        | Jolt.EAllowedDOFs_TranslationY
        | Jolt.EAllowedDOFs_TranslationZ
      );
    }
    creationSettings.mAllowSleeping = allowSleeping;
    creationSettings.mGravityFactor = gravityFactor;
    if (mass !== undefined) {
      creationSettings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      creationSettings.mMassPropertiesOverride.mMass = mass;
    }
    const body = bodyInterface.CreateBody(creationSettings);
    Jolt.destroy(creationSettings);
    bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    return body;
  }

  removeBody(body: initJolt.Body) {
    const { bodyInterface } = this;
    bodyInterface.RemoveBody(body.GetID());
    bodyInterface.DestroyBody(body.GetID());
  }

  addBodyImpulse(body: initJolt.Body, impulse: vec3) {
    const { bodyInterface, Jolt } = this;
    const imp = new Jolt.Vec3(impulse[0], impulse[1], impulse[2]);
    bodyInterface.AddImpulse(body.GetID(), imp);
    Jolt.destroy(imp);
  }

  setBodyPosition(body: initJolt.Body, position: vec3, resetVelocity = false) {
    const { bodyInterface, Jolt } = this;
    const pos = new Jolt.RVec3(position[0], position[1], position[2]);
    bodyInterface.SetPosition(body.GetID(), pos, Jolt.EActivation_Activate);
    Jolt.destroy(pos);
    if (resetVelocity) {
      bodyInterface.SetLinearAndAngularVelocity(body.GetID(), Jolt.Vec3.prototype.sZero(), Jolt.Vec3.prototype.sZero());
    }
  }

  setBodyLinearVelocity(body: initJolt.Body, velocity: vec3) {
    const { bodyInterface, Jolt } = this;
    const vel = new Jolt.Vec3(velocity[0], velocity[1], velocity[2]);
    bodyInterface.SetLinearVelocity(body.GetID(), vel);
    Jolt.destroy(vel);
  }

  setOnContact(callback: typeof this.onContact) {
    this.onContact = callback;
  }

  step(delta: number) {
    const { jolt } = this;
    const steps = delta > 1 / 55 ? 2 : 1;
    jolt.Step(delta, steps);
  }
}
