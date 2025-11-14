/**
 * Demonstration der EntityId<TAggregateType> Nutzung.
 * Zeigt alle Features: Auto-Generation, Validation, Type-Safety, Result Pattern.
 */

import { EntityId } from '@domain/common/entity-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';

// ============================================
// 1. AUTO-GENERATION (kein Parameter)
// ============================================
console.log('=== 1. AUTO-GENERATION ===');
const autoId = EinsatzId.create();
if (autoId.isSuccess) {
  console.log('✅ Auto-generated Einsatz ID:', autoId.value?.toString());
  console.log('   Length:', autoId.value?.value.length); // 21
  console.log('   Valid format:', /^[A-Za-z0-9_-]{21}$/.test(autoId.value?.value || ''));
}

// ============================================
// 2. VALIDATION - Success Case
// ============================================
console.log('\n=== 2. VALIDATION - Success ===');
const validNanoid = 'A1B2C3D4E5F6G7H8I9J0K'; // Valid 21-char nanoid
const validId = EinsatzId.create(validNanoid);
if (validId.isSuccess) {
  console.log('✅ Valid Einsatz ID:', validId.value?.toString());
}

// ============================================
// 3. VALIDATION - Failure Case
// ============================================
console.log('\n=== 3. VALIDATION - Failure ===');
const invalidId = EinsatzId.create('too-short'); // Invalid format
if (invalidId.isFailure) {
  console.log('❌ Validation failed:', invalidId.error);
}

// ============================================
// 4. TYPE-SAFETY (Compile-time checking)
// ============================================
console.log('\n=== 4. TYPE-SAFETY ===');

// Correct: Function accepts EinsatzId
function processEinsatz(id: EinsatzId): string {
  return `Processing Einsatz with ID: ${id.toString()}`;
}

const einsatzId = EinsatzId.create().value as EinsatzId;
console.log('✅', processEinsatz(einsatzId));

// Incorrect: Trying to pass UserId (would cause compile error)
const userId = UserId.create().value as UserId;
// processEinsatz(userId); // ❌ TypeScript Compile Error!
// Error: Argument of type 'UserId' is not assignable to parameter of type 'EinsatzId'

console.log('   UserId constructor:', userId.constructor.name); // "UserId"
console.log('   EinsatzId constructor:', einsatzId.constructor.name); // "EinsatzId"
console.log('   Different types at runtime:', userId.constructor !== einsatzId.constructor);

// ============================================
// 5. EQUALITY (Value-based comparison)
// ============================================
console.log('\n=== 5. EQUALITY ===');
const sharedNanoid = 'X1Y2Z3A4B5C6D7E8F9G0H';
const id1 = EinsatzId.create(sharedNanoid).value as EinsatzId;
const id2 = EinsatzId.create(sharedNanoid).value as EinsatzId;
const id3 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value as EinsatzId;

console.log('✅ Same value → equals():', id1.equals(id2)); // true
console.log('✅ Different value → equals():', id1.equals(id3)); // false
console.log('   Different instances:', id1 !== id2); // true (reference inequality)

// ============================================
// 6. RESULT PATTERN (Explicit error handling)
// ============================================
console.log('\n=== 6. RESULT PATTERN ===');

const result = UserId.create();
if (result.isSuccess) {
  const id = result.value!; // Safe because isSuccess === true
  console.log('✅ Success:', id.toString());
  console.log('   isSuccess:', result.isSuccess);
  console.log('   value defined:', result.value !== undefined);
  console.log('   error undefined:', result.error === undefined);
} else {
  console.log('❌ Failure:', result.error);
}

// ============================================
// 7. HASH CODE (Set/Map compatibility)
// ============================================
console.log('\n=== 7. HASH CODE ===');
const hashId1 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value as EinsatzId;
const hashId2 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value as EinsatzId;

console.log('✅ Hash code id1:', hashId1.hashCode());
console.log('   Hash code id2:', hashId2.hashCode());
console.log('   Same hash for equal values:', hashId1.hashCode() === hashId2.hashCode());

// ============================================
// 8. IMMUTABILITY (Runtime enforcement)
// ============================================
console.log('\n=== 8. IMMUTABILITY ===');
const immutableId = EinsatzId.create().value as EinsatzId;
console.log('✅ Props frozen:', Object.isFrozen(immutableId.props));

try {
  // @ts-expect-error - Testing runtime immutability
  immutableId.props.value = 'should-fail';
  console.log('❌ Immutability FAILED - props were modified!');
} catch (error) {
  console.log('✅ Immutability enforced - cannot modify props');
}

// ============================================
// 9. CUSTOM ENTITY ID CLASSES
// ============================================
console.log('\n=== 9. CUSTOM ENTITY IDS ===');

// Custom EntityId für zukünftige Aggregates
class LagekarteId extends EntityId<'Lagekarte'> {}
class EtbId extends EntityId<'ETB'> {}

const lagekarteId = LagekarteId.create().value as LagekarteId;
const etbId = EtbId.create().value as EtbId;

console.log('✅ LagekarteId:', lagekarteId.toString());
console.log('   ETB ID:', etbId.toString());
console.log('   Different types:', lagekarteId.constructor.name !== etbId.constructor.name);

console.log('\n=== Demo completed successfully! ===');
