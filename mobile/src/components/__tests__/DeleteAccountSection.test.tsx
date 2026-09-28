import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DeleteAccountSection } from '../DeleteAccountSection';

const mockDeleteAccount = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ deleteAccount: mockDeleteAccount }) }));

describe('DeleteAccountSection', () => {
  beforeEach(() => mockDeleteAccount.mockReset());

  it('asks for password + confirmation before deleting', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    mockDeleteAccount.mockResolvedValue(undefined);

    render(<DeleteAccountSection />);
    fireEvent.press(screen.getByText('Бүртгэл устгах'));
    fireEvent.changeText(screen.getByPlaceholderText('Нууц үг'), 'secret');
    fireEvent.press(screen.getByText('Бүрмөсөн устгах'));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith('secret'));
  });

  it('shows the server error', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    mockDeleteAccount.mockRejectedValue(new Error('Нууц үг буруу байна'));

    render(<DeleteAccountSection />);
    fireEvent.press(screen.getByText('Бүртгэл устгах'));
    fireEvent.changeText(screen.getByPlaceholderText('Нууц үг'), 'bad');
    fireEvent.press(screen.getByText('Бүрмөсөн устгах'));

    expect(await screen.findByText('Нууц үг буруу байна')).toBeTruthy();
  });
});
