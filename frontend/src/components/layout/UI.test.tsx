import {describe,it,expect,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {State} from './UI';
afterEach(cleanup);
describe('Analytical states',()=>{
 it('shows a readable loading state without inventing numbers',()=>{render(<State loading><span>123 trips</span></State>);expect(screen.getByText('Reading the city’s pulse…')).toBeTruthy();expect(screen.queryByText('123 trips')).toBeNull();});
 it('exposes server errors accessibly',()=>{render(<State error={new Error('Dataset is not ready')}/>);expect(screen.getByRole('alert').textContent).toContain('Dataset is not ready');expect(screen.getByRole('button',{name:'Retry connection'})).toBeTruthy();});
 it('distinguishes empty selections from backend failures',()=>{render(<State empty/>);expect(screen.getByText('No trips in this selection')).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();});
});
