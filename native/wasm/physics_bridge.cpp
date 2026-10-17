/**
 * Optional native physics bridge for performance-critical calculations.
 * Can be compiled to WebAssembly for faster physics math.
 */

#include <cmath>
#include <cstring>

extern "C" {

// Vector3 operations
struct Vec3 {
    float x, y, z;
};

struct Quat {
    float x, y, z, w;
};

// Fast vector operations
Vec3 vec3_add(Vec3 a, Vec3 b) {
    return {a.x + b.x, a.y + b.y, a.z + b.z};
}

Vec3 vec3_sub(Vec3 a, Vec3 b) {
    return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3 vec3_scale(Vec3 v, float s) {
    return {v.x * s, v.y * s, v.z * s};
}

float vec3_length(Vec3 v) {
    return sqrtf(v.x * v.x + v.y * v.y + v.z * v.z);
}

Vec3 vec3_normalize(Vec3 v) {
    float len = vec3_length(v);
    if (len < 0.0001f) return {0, 0, 0};
    float inv = 1.0f / len;
    return {v.x * inv, v.y * inv, v.z * inv};
}

float vec3_dot(Vec3 a, Vec3 b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

Vec3 vec3_cross(Vec3 a, Vec3 b) {
    return {
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    };
}

// Quaternion operations
Quat quat_multiply(Quat a, Quat b) {
    return {
        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    };
}

Quat quat_from_axis_angle(Vec3 axis, float angle) {
    float half = angle * 0.5f;
    float s = sinf(half);
    Vec3 n = vec3_normalize(axis);
    return {n.x * s, n.y * s, n.z * s, cosf(half)};
}

Vec3 quat_rotate(Quat q, Vec3 v) {
    Quat vq = {v.x, v.y, v.z, 0};
    Quat conj = {-q.x, -q.y, -q.z, q.w};
    Quat result = quat_multiply(quat_multiply(q, vq), conj);
    return {result.x, result.y, result.z};
}

// Vehicle physics helpers
struct WheelState {
    Vec3 position;
    Vec3 normal;
    float suspensionLength;
    float slip;
    bool grounded;
};

// Simple suspension calculation
WheelState calculate_suspension(
    Vec3 wheelPos,
    Vec3 wheelVelocity,
    Vec3 groundNormal,
    float restLength,
    float stiffness,
    float damping,
    float maxTravel
) {
    WheelState state;
    state.position = wheelPos;
    state.normal = groundNormal;
    state.grounded = true;
    
    // Spring force
    float compression = restLength - maxTravel;
    float springForce = compression * stiffness;
    float dampForce = vec3_dot(wheelVelocity, groundNormal) * damping;
    
    state.suspensionLength = restLength - (springForce + dampForce) / stiffness;
    state.slip = 0.0f;
    
    return state;
}

// Tire friction model (simplified Pacejka)
float calculate_tire_force(float slip, float load, float frictionCoeff) {
    // Simplified magic formula
    float B = 10.0f;
    float D = frictionCoeff * load;
    float E = 0.9f;
    
    float slipAngle = slip;
    float y = D * sinf(atanf(B * slipAngle - E * (B * slipAngle - atanf(B * slipAngle))));
    
    return y;
}

} // extern "C"
