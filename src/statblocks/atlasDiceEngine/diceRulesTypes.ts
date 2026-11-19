/** Minimal shape of Atlas's exploding-dice rule, kept local to the isolated Rest roller. */
export interface ExplodeRule {
  dice: 'default' | 'all';
  repeats: boolean;
  highFaces: number;
  lowFaces: number;
}
